import { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useConfigStore } from '@/stores'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Form } from '@/components/ui/form'
import { ArrowDownUp } from 'lucide-react'
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

export interface SwapFormProps {
  preselectedVaultId?: string
  onVaultChange?: (vaultId: string) => void
}

function useSwapForm({ preselectedVaultId, onVaultChange }: SwapFormProps) {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { data: vaults = [], isLoading: isLoadingVaults } = useVaultsQuery()
  const config = useConfigStore((s) => s.config)

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
    }
  }, [preselectedVaultId, form])

  const vaultId = form.watch('vaultId')
  const inputAmount = form.watch('inputAmount')
  const slippage = form.watch('slippage')

  const [inputToken, setInputToken] = useState('SOL')
  const [outputToken, setOutputToken] = useState('USDC')
  const [showConfirm, setShowConfirm] = useState(false)
  const [maxBalance, setMaxBalance] = useState<number | null>(null)

  useEffect(() => {
    let isMounted = true
    if (!wallet.publicKey) {
      setMaxBalance(null)
      return
    }
    connection
      .getBalance(wallet.publicKey)
      .then((bal) => {
        if (isMounted) setMaxBalance(bal / LAMPORTS_PER_SOL)
      })
      .catch(() => {
        if (isMounted) setMaxBalance(null)
      })
    return () => {
      isMounted = false
    }
  }, [wallet.publicKey, connection])

  const handleSetMax = useCallback(() => {
    if (maxBalance !== null) {
      form.setValue('inputAmount', maxBalance.toString(), { shouldValidate: true })
    } else {
      form.setValue('inputAmount', '10.0', { shouldValidate: true })
    }
  }, [maxBalance, form])

  const { execute, isLoading: isExecuting } = useExecuteTrade()

  const pythPriceFeedId = `${inputToken}/${outputToken}`
  const priceData: PriceState = usePythPrice(pythPriceFeedId)

  const tokens = config?.focusAssetsWhitelist ?? ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'PYTH']

  const inputNum = parseFloat(inputAmount) || 0
  const rate = priceData.status === 'live' || priceData.status === 'stale' ? priceData.price : 0
  const outputAmount = inputNum * rate
  const minReceived = outputAmount * (1 - slippage / 100)

  const handleVaultChange = useCallback(
    (value: string) => {
      form.setValue('vaultId', value)
      onVaultChange?.(value)
    },
    [form, onVaultChange],
  )

  const onSubmit = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!vaultId || !inputNum) return
    await execute({
      vaultId,
      inputToken,
      outputToken,
      amountIn: inputNum,
      amountOut: outputAmount,
      priceAtExecution: rate,
      slippage,
    })
    setShowConfirm(false)
  }, [vaultId, inputNum, inputToken, outputToken, outputAmount, rate, slippage, execute])

  const toggleDirection = () => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
  }

  return {
    form,
    vaults,
    isLoadingVaults,
    vaultId,
    slippage,
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    showConfirm,
    setShowConfirm,
    maxBalance,
    handleSetMax,
    tokens,
    inputNum,
    rate,
    outputAmount,
    minReceived,
    priceData,
    isExecuting,
    walletConnected: wallet.connected,
    onSubmit,
    handleConfirm,
    handleVaultChange,
    toggleDirection,
  }
}

export function SwapForm({ preselectedVaultId, onVaultChange }: SwapFormProps) {
  const {
    form,
    vaults,
    isLoadingVaults,
    vaultId,
    slippage,
    inputToken,
    setInputToken,
    outputToken,
    setOutputToken,
    showConfirm,
    setShowConfirm,
    maxBalance,
    handleSetMax,
    tokens,
    inputNum,
    rate,
    outputAmount,
    minReceived,
    priceData,
    isExecuting,
    walletConnected,
    onSubmit,
    handleConfirm,
    handleVaultChange,
    toggleDirection,
  } = useSwapForm({ preselectedVaultId, onVaultChange })

  return (
    <div className="grid gap-5 lg:grid-cols-5 items-start">
      <div className="space-y-4 lg:col-span-3">
        <Form {...form}>
          <SectionCard
            icon={<ArrowDownUp className="size-4 text-primary-coral" />}
            title="Swap Consol"
            description="Execute Pyth Oracle-powered AMM swaps"
            rightContent={
              <VaultSelectField
                vaults={vaults}
                isLoading={isLoadingVaults}
                onVaultChange={handleVaultChange}
              />
            }
          >
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <PayInputField
                maxBalance={maxBalance}
                onSetMax={handleSetMax}
                tokens={tokens}
                inputToken={inputToken}
                onInputTokenChange={setInputToken}
              />

              <SwapDirectionToggle onToggle={toggleDirection} />

              <ReceiveSection
                outputAmount={outputAmount}
                tokens={tokens}
                outputToken={outputToken}
                onOutputTokenChange={setOutputToken}
              />

              <SlippageField />

              <SwapActionButton
                disabled={!vaultId || !inputNum || !walletConnected || isExecuting}
                isExecuting={isExecuting}
                walletConnected={walletConnected}
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
