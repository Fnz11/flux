import { useState, useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConfigStore } from '@/stores'
import { useVaultsQuery, useVaultBalancesQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Form } from '@/components/ui/form'
import { ArrowDownUp, Lock } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { PriceDisplay } from './PriceDisplay'
import { ConfirmationDialog } from './ConfirmationDialog'
import { usePythPrice } from '@/hooks/usePythPrice'
import { useExecuteTrade } from '@/hooks/useExecuteTrade'
import type { PriceState } from './PriceDisplay'
import { swapSchema, type SwapFormValues } from '@/validations/trade'
import { VaultSelectField } from './VaultSelectField'
import { PayInputField } from './PayInputField'
import { SwapDirectionToggle } from './SwapDirectionToggle'
import { ReceiveSection } from './ReceiveSection'
import { SlippageField } from './SlippageField'
import { SwapActionButton } from './SwapActionButton'
import { RouteDetails } from './RouteDetails'
import { getTradeEligibility } from '@/lib/eligibility'

import { DEFAULT_FOCUS_ASSETS_WHITELIST } from '@/constants/tokens'
import type { Vault } from '@/types'

export interface SwapFormProps {
  preselectedVaultId?: string
  vaults?: Vault[]
  isLoadingVaults?: boolean
  onVaultChange?: (vaultId: string) => void
}

function useSwapForm({ preselectedVaultId, vaults: customVaults, isLoadingVaults: customIsLoading, onVaultChange }: SwapFormProps) {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''
  const { data: fetchedVaults = [], isLoading: isFetchingVaults } = useVaultsQuery()
  const config = useConfigStore((s) => s.config)

  const vaults = useMemo(() => {
    if (customVaults !== undefined) return customVaults
    if (!walletAddress) return []
    return fetchedVaults.filter(
      (v) =>
        v.managerAddress &&
        v.managerAddress.toLowerCase() === walletAddress.toLowerCase() &&
        (v.status?.toLowerCase() === 'active' || v.status?.toLowerCase() === 'fundraising')
    )
  }, [customVaults, fetchedVaults, walletAddress])

  const isLoadingVaults = customIsLoading !== undefined ? customIsLoading : isFetchingVaults

  const form = useForm<SwapFormValues>({
    resolver: zodResolver(swapSchema),
    defaultValues: {
      vaultId: preselectedVaultId ?? '',
      inputAmount: '',
      slippage: 0.5,
    },
  })

  useEffect(() => {
    if (preselectedVaultId) {
      form.setValue('vaultId', preselectedVaultId)
    } else if (vaults.length > 0 && !form.getValues('vaultId')) {
      form.setValue('vaultId', vaults[0].id)
    }
  }, [preselectedVaultId, vaults, form])

  const vaultId = form.watch('vaultId')
  const inputAmount = form.watch('inputAmount')
  const slippage = form.watch('slippage')

  const [inputToken, setInputToken] = useState('SOL')
  const [outputToken, setOutputToken] = useState('USDC')
  const [showConfirm, setShowConfirm] = useState(false)

  // Fetch balances of the selected active vault
  const { data: vaultBalances = [], isLoading: isLoadingBalances } = useVaultBalancesQuery(vaultId ?? '')

  const selectedVault = useMemo(() => {
    return vaults.find((v) => v.id === vaultId || v.address === vaultId)
  }, [vaults, vaultId])

  const currentAsset = useMemo(() => {
    const found = vaultBalances.find(
      (b) =>
        b.symbol?.toUpperCase() === inputToken.toUpperCase() ||
        b.mint?.toLowerCase() === inputToken.toLowerCase()
    )
    if (found) return found
    if (selectedVault && selectedVault.tvl > 0 && (inputToken.toUpperCase() === 'SOL' || inputToken === 'So11111111111111111111111111111111111111112')) {
      const solPrice = 150
      return {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        amount: selectedVault.tvl / solPrice,
        usdValue: selectedVault.tvl,
      }
    }
    return undefined
  }, [vaultBalances, inputToken, selectedVault])

  const maxBalance = useMemo(() => {
    if (!vaultId || isLoadingBalances) return null
    let max = 0
    if (currentAsset) {
      max = currentAsset.amount
    } else if (selectedVault && selectedVault.tvl > 0 && inputToken.toUpperCase() === 'SOL') {
      max = selectedVault.tvl / 150
    }
    return max
  }, [vaultId, isLoadingBalances, currentAsset, selectedVault, inputToken])

  const handleSetMax = useCallback(() => {
    if (maxBalance !== null && maxBalance > 0) {
      form.setValue('inputAmount', maxBalance.toString(), { shouldValidate: true })
    } else {
      form.setValue('inputAmount', '0', { shouldValidate: true })
    }
  }, [maxBalance, form])

  const { execute, isLoading: isExecuting } = useExecuteTrade()

  const pythPriceFeedId = `${inputToken}/${outputToken}`
  const priceData: PriceState = usePythPrice(pythPriceFeedId)

  const focusOrWhitelistTokens = useMemo(() => {
    const focusAssets = selectedVault?.metadata?.focusAssets
    const rawList = Array.isArray(focusAssets) && focusAssets.length > 0
      ? focusAssets
      : (config?.focusAssetsWhitelist ?? DEFAULT_FOCUS_ASSETS_WHITELIST)
    return rawList.filter((t) => t.toUpperCase() !== 'BONK')
  }, [selectedVault, config])

  const payTokens = useMemo(() => {
    const set = new Set<string>()
    // 1. Prioritize all tokens held by the vault with positive balance
    for (const b of vaultBalances) {
      if (b.symbol && (b.amount > 0 || (b.usdValue && b.usdValue > 0))) {
        set.add(b.symbol.toUpperCase())
      }
    }
    // 2. If vault has TVL, ensure SOL is also available to pay with
    if (selectedVault && selectedVault.tvl > 0) {
      set.add('SOL')
    }
    // 3. Include focus assets / whitelist
    for (const t of focusOrWhitelistTokens) {
      set.add(t.toUpperCase())
    }
    const list = Array.from(set).filter((t) => t !== 'BONK')
    return list.length > 0 ? list : ['SOL', 'USDC']
  }, [vaultBalances, selectedVault, focusOrWhitelistTokens])

  const receiveTokens = useMemo(() => {
    return focusOrWhitelistTokens.length > 0 ? focusOrWhitelistTokens : ['USDC', 'SOL']
  }, [focusOrWhitelistTokens])

  useEffect(() => {
    if (!payTokens.length || !receiveTokens.length) return
    let currentInput = inputToken
    let currentOutput = outputToken

    if (!payTokens.includes(currentInput)) {
      currentInput = payTokens[0]
      setInputToken(currentInput)
    }

    if (!receiveTokens.includes(currentOutput) || (currentOutput === currentInput && receiveTokens.length > 1)) {
      currentOutput = receiveTokens.find((t) => t !== currentInput) ?? receiveTokens[0]
      setOutputToken(currentOutput)
    }
  }, [payTokens, receiveTokens, inputToken, outputToken])

  const [sliderValue, setSliderValue] = useState(0)

  const inputNum = parseFloat(inputAmount) || 0

  // Sync slider when inputAmount changes manually
  useEffect(() => {
    if (maxBalance && maxBalance > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((inputNum / maxBalance) * 100)))
      setSliderValue(pct)
    } else {
      setSliderValue(0)
    }
  }, [inputNum, maxBalance])

  const handlePercentageClick = useCallback((pct: number) => {
    setSliderValue(pct)
    if (maxBalance !== null && maxBalance > 0) {
      const precision = inputToken === 'SOL' ? 4 : 2
      const factor = 10 ** precision
      const calculated = (Math.floor(maxBalance * (pct / 100) * factor + 1e-9) / factor).toFixed(precision)
      form.setValue('inputAmount', calculated, { shouldValidate: true })
    } else {
      form.setValue('inputAmount', '0', { shouldValidate: true })
    }
  }, [maxBalance, inputToken, form])

  const handleSliderChange = useCallback((val: number) => {
    setSliderValue(val)
    if (maxBalance !== null && maxBalance > 0) {
      const precision = inputToken === 'SOL' ? 4 : 2
      const factor = 10 ** precision
      const calculated = (Math.floor(maxBalance * (val / 100) * factor + 1e-9) / factor).toFixed(precision)
      form.setValue('inputAmount', calculated, { shouldValidate: true })
    } else {
      form.setValue('inputAmount', '0', { shouldValidate: true })
    }
  }, [maxBalance, inputToken, form])

  const rate = priceData.status === 'live' || priceData.status === 'stale' ? priceData.price : 0
  const outputAmount = inputNum * rate
  const minReceived = outputAmount * (1 - slippage / 100)
  const isInsufficientBalance = maxBalance !== null && inputNum > maxBalance

  const handleVaultChange = useCallback(
    (value: string) => {
      form.setValue('vaultId', value)
      onVaultChange?.(value)
    },
    [form, onVaultChange],
  )

  const onSubmit = useCallback(() => {
    if (isInsufficientBalance) {
      form.setError('inputAmount', {
        type: 'manual',
        message: `Amount exceeds active vault balance (${maxBalance ?? 0})`,
      })
      return
    }
    setShowConfirm(true)
  }, [isInsufficientBalance, maxBalance, form])

  const handleConfirm = useCallback(async () => {
    if (!vaultId || !inputNum) return
    console.log('[SwapForm] Confirming swap with params:', {
      vaultId,
      vaultAddress: selectedVault?.address,
      inputToken,
      outputToken,
      amountIn: inputNum,
      amountOut: outputAmount,
      priceAtExecution: rate,
      slippage,
    })
    await execute({
      vaultId,
      vaultAddress: selectedVault?.address,
      inputToken,
      outputToken,
      amountIn: inputNum,
      amountOut: outputAmount,
      priceAtExecution: rate,
      slippage,
    })
    setShowConfirm(false)
  }, [vaultId, selectedVault, inputNum, inputToken, outputToken, outputAmount, rate, slippage, execute])

  const handleInputTokenChange = useCallback((token: string) => {
    if (token === outputToken) {
      const nextOutput = receiveTokens.find((t) => t !== token) ?? token
      setOutputToken(inputToken !== token ? inputToken : nextOutput)
    }
    setInputToken(token)
  }, [inputToken, outputToken, receiveTokens])

  const handleOutputTokenChange = useCallback((token: string) => {
    if (token === inputToken) {
      const nextInput = payTokens.find((t) => t !== token) ?? token
      setInputToken(outputToken !== token ? outputToken : nextInput)
    }
    setOutputToken(token)
  }, [inputToken, outputToken, payTokens])

  const toggleDirection = () => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
  }

  return {
    form,
    vaults,
    isLoadingVaults,
    vaultId,
    selectedVault,
    slippage,
    inputToken,
    setInputToken: handleInputTokenChange,
    outputToken,
    setOutputToken: handleOutputTokenChange,
    showConfirm,
    setShowConfirm,
    maxBalance,
    handleSetMax,
    payTokens,
    receiveTokens,
    inputNum,
    rate,
    outputAmount,
    minReceived,
    isVaultFundraising: selectedVault?.status?.toLowerCase() === 'fundraising',
    isManager: selectedVault?.managerAddress?.toLowerCase() === wallet.publicKey?.toBase58().toLowerCase(),
    tradeEligibility: getTradeEligibility(
      selectedVault,
      selectedVault?.managerAddress?.toLowerCase() === wallet.publicKey?.toBase58().toLowerCase(),
      wallet.connected,
    ),
    priceData,
    isExecuting,
    walletConnected: wallet.connected,
    isInsufficientBalance,
    sliderValue,
    handleSliderChange,
    handlePercentageClick,
    onSubmit,
    handleConfirm,
    handleVaultChange,
    toggleDirection,
  }
}

export function SwapForm({ preselectedVaultId, vaults: customVaults, isLoadingVaults: customIsLoading, onVaultChange }: SwapFormProps) {
  const {
    form,
    vaults,
    isLoadingVaults,
    vaultId,
    selectedVault,
    isVaultFundraising,
    isManager,
    tradeEligibility,
    slippage,
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    showConfirm,
    setShowConfirm,
    maxBalance,
    handleSetMax,
    payTokens,
    receiveTokens,
    inputNum,
    rate,
    outputAmount,
    minReceived,
    priceData,
    isExecuting,
    walletConnected,
    isInsufficientBalance,
    sliderValue,
    handleSliderChange,
    onSubmit,
    handleConfirm,
    handleVaultChange,
    toggleDirection,
  } = useSwapForm({ preselectedVaultId, vaults: customVaults, isLoadingVaults: customIsLoading, onVaultChange })

  return (
    <div className="grid gap-5 lg:grid-cols-5 items-start">
      <div className="space-y-4 lg:col-span-3 relative z-20">
        <Form {...form}>
          <SectionCard
            icon={<ArrowDownUp className="size-4 text-primary-coral" />}
            title="Swap Console"
            description="Execute Pyth Oracle-powered AMM swaps"
            rightContent={
              <VaultSelectField
                vaults={vaults}
                isLoading={isLoadingVaults}
                onVaultChange={handleVaultChange}
              />
            }
          >
            {isVaultFundraising && selectedVault && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-status-warn/25 bg-status-warn/10 p-3 text-xs text-status-warn">
                <Lock className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-status-warn">
                    {isManager ? 'Vault Ready for Activation' : 'Vault Locked — Fundraising Phase'}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5">
                    {isManager 
                      ? `This vault is in Fundraising phase. Your first trade will automatically activate it as long as the target (${selectedVault.minRaiseAmount ?? '0'} ${selectedVault.metadata?.focusAssets?.[0] ?? 'SOL'}) is met.`
                      : `This vault has not reached its minimum raise target (${selectedVault.minRaiseAmount ?? '0'} ${selectedVault.metadata?.focusAssets?.[0] ?? 'SOL'}) or been activated yet. Trading will unlock once the target is met.`}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <PayInputField
                maxBalance={maxBalance}
                onSetMax={handleSetMax}
                tokens={payTokens}
                inputToken={inputToken}
                onInputTokenChange={setInputToken}
                disabledTokens={[outputToken]}
                sliderValue={sliderValue}
                onSliderChange={handleSliderChange}
              />

              <SwapDirectionToggle onToggle={toggleDirection} />

              <ReceiveSection
                outputAmount={outputAmount}
                tokens={receiveTokens}
                outputToken={outputToken}
                onOutputTokenChange={setOutputToken}
                disabledTokens={[inputToken]}
              />

              <SlippageField />

              <SwapActionButton
                disabled={!tradeEligibility.canExecute || !inputNum || !walletConnected || isExecuting || isInsufficientBalance}
                isExecuting={isExecuting}
                walletConnected={walletConnected}
                isInsufficientBalance={isInsufficientBalance}
                isVaultFundraising={isVaultFundraising}
                isManager={isManager}
                hasVault={Boolean(vaultId)}
                hasAmount={Boolean(inputNum)}
                reason={tradeEligibility.reason}
              />
            </form>
          </SectionCard>
        </Form>

        <ConfirmationDialog
          open={showConfirm}
          onConfirm={handleConfirm}
          onClose={() => setShowConfirm(false)}
          inputToken={inputToken}
          outputToken={outputToken}
          inputAmount={inputNum}
          outputAmount={outputAmount}
          rate={rate}
          slippage={slippage}
          minReceived={minReceived}
          networkFee={0.000005}
          isLoading={isExecuting}
        />
      </div>

      <div className="space-y-5 lg:col-span-2">
        <PriceDisplay data={priceData} />

        <RouteDetails
          inputToken={inputToken}
          outputToken={outputToken}
          slippage={slippage}
          minReceived={minReceived}
        />
      </div>
    </div>
  )
}
