import { useState, useCallback, useEffect } from 'react'
import { useForm, useFormContext } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { useConfigStore } from '@/stores'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { ArrowDownUp, Loader2 } from 'lucide-react'
import { TokenSelector } from './TokenSelector'
import { PriceDisplay } from './PriceDisplay'
import { ConfirmationDialog } from './ConfirmationDialog'
import { usePythPrice } from '@/hooks/usePythPrice'
import { useExecuteTrade } from '@/hooks/useExecuteTrade'
import type { PriceState } from './PriceDisplay'
import type { Vault } from '@/types'

const swapSchema = z.object({
  vaultId: z.string().min(1, 'Please select a vault'),
  inputAmount: z
    .string()
    .min(1, 'Amount is required')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be greater than 0',
    }),
  slippage: z
    .number()
    .min(0.01, 'Slippage must be at least 0.01%')
    .max(100, 'Slippage cannot exceed 100%'),
})

type SwapFormValues = z.infer<typeof swapSchema>

interface SwapFormProps {
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

interface VaultSelectFieldProps {
  vaults: Vault[]
  isLoading: boolean
  onVaultChange: (value: string) => void
}

function VaultSelectField({ vaults, isLoading, onVaultChange }: VaultSelectFieldProps) {
  return (
    <FormField
      name="vaultId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs text-text-tertiary">Vault</FormLabel>
          <FormControl>
            <Select
              value={field.value}
              onValueChange={onVaultChange}
              disabled={isLoading || vaults.length === 0}
            >
              <SelectTrigger id="vault-select" className="w-full">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-text-tertiary">
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Loading vaults...</span>
                  </div>
                ) : (
                  <SelectValue placeholder={vaults.length === 0 ? "No vaults available" : "Select vault..."} />
                )}
              </SelectTrigger>
              <SelectContent>
                {vaults.length === 0 ? (
                  <SelectItem disabled value="empty">
                    No vaults available
                  </SelectItem>
                ) : (
                  vaults.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.metadata.displayName || v.id.slice(0, 8)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

interface PayInputFieldProps {
  maxBalance: number | null
  onSetMax: () => void
  tokens: string[]
  inputToken: string
  onInputTokenChange: (token: string) => void
}

function PayInputField({
  maxBalance,
  onSetMax,
  tokens,
  inputToken,
  onInputTokenChange,
}: PayInputFieldProps) {
  return (
    <FormField
      name="inputAmount"
      render={({ field }) => (
        <FormItem className="rounded-xl bg-bg-inset p-4 space-y-0">
          <div className="flex items-center justify-between">
            <FormLabel className="text-xs text-text-tertiary">You pay</FormLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSetMax}
              className="h-auto px-2 py-0.5 text-xs text-primary-coral hover:bg-primary-coral/10 font-mono transition-colors"
            >
              Max ({maxBalance !== null ? maxBalance.toFixed(2) : '10.0'})
            </Button>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <FormControl>
              <Input
                {...field}
                id="pay-amount"
                type="number"
                placeholder="0.00"
                className="flex-1 bg-transparent font-mono text-xl border-0 h-auto p-0 focus-visible:ring-0"
              />
            </FormControl>
            <TokenSelector
              tokens={tokens}
              selected={inputToken}
              onSelect={onInputTokenChange}
            />
          </div>
          <FormMessage className="mt-1" />
        </FormItem>
      )}
    />
  )
}

function SwapDirectionToggle({ onToggle }: { onToggle: () => void }) {
  return (
    <div className="flex justify-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-label="Swap direction"
      >
        <ArrowDownUp className="size-4" />
      </Button>
    </div>
  )
}

interface ReceiveSectionProps {
  outputAmount: number
  tokens: string[]
  outputToken: string
  onOutputTokenChange: (token: string) => void
}

function ReceiveSection({
  outputAmount,
  tokens,
  outputToken,
  onOutputTokenChange,
}: ReceiveSectionProps) {
  return (
    <div className="rounded-xl bg-bg-inset p-4">
      <FormLabel className="text-xs text-text-tertiary">You receive</FormLabel>
      <div className="mt-1 flex items-center gap-3">
        <p className="flex-1 font-mono text-xl text-text-primary">
          {outputAmount > 0 ? outputAmount.toFixed(6) : '0.00'}
        </p>
        <TokenSelector
          tokens={tokens}
          selected={outputToken}
          onSelect={onOutputTokenChange}
        />
      </div>
    </div>
  )
}

function SlippageField() {
  const { setValue } = useFormContext<SwapFormValues>()
  return (
    <FormField
      name="slippage"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs text-text-tertiary">Slippage (%)</FormLabel>
          <FormControl>
            <div className="flex gap-2">
              {[0.1, 0.5, 1.0, 2.0].map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={field.value === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setValue('slippage', s, { shouldValidate: true })}
                >
                  {s}%
                </Button>
              ))}
              <Input
                id="custom-slippage"
                type="number"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                step="0.1"
                min="0"
                max="100"
                className="w-16 px-2 py-1.5 text-xs h-auto"
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

interface SwapActionButtonProps {
  disabled: boolean
  isExecuting: boolean
  walletConnected: boolean
}

function SwapActionButton({ disabled, isExecuting, walletConnected }: SwapActionButtonProps) {
  return (
    <Button
      type="submit"
      variant="sweep"
      className="mt-5 w-full"
      disabled={disabled}
    >
      {isExecuting ? 'Swapping...' : !walletConnected ? 'Connect Wallet' : 'Execute Swap'}
    </Button>
  )
}

interface RouteDetailsProps {
  inputToken: string
  outputToken: string
  slippage: number
  minReceived: number
}

function RouteDetails({ inputToken, outputToken, slippage, minReceived }: RouteDetailsProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-4 space-y-3">
      <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Oracle & Order Route Details</h3>
      <div className="space-y-2 text-xs font-mono">
        <div className="flex justify-between py-1 border-b border-border-subtle">
          <span className="text-text-tertiary font-sans">Route Pair</span>
          <span className="text-text-primary font-medium">{inputToken} / {outputToken}</span>
        </div>
        <div className="flex justify-between py-1 border-b border-border-subtle">
          <span className="text-text-tertiary font-sans">Price Oracle</span>
          <span className="text-status-success font-medium">Pyth Hermes Network</span>
        </div>
        <div className="flex justify-between py-1 border-b border-border-subtle">
          <span className="text-text-tertiary font-sans">Max Slippage</span>
          <span className="text-text-primary font-medium">{slippage}%</span>
        </div>
        <div className="flex justify-between py-1 border-b border-border-subtle">
          <span className="text-text-tertiary font-sans">Min Received</span>
          <span className="text-text-primary font-medium">{minReceived > 0 ? minReceived.toFixed(4) : '0.0000'} {outputToken}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-text-tertiary font-sans">Estimated Network Fee</span>
          <span className="text-text-muted">~0.000005 SOL</span>
        </div>
      </div>
    </div>
  )
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
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-primary">Swap</h2>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5">
              <VaultSelectField
                vaults={vaults}
                isLoading={isLoadingVaults}
                onVaultChange={handleVaultChange}
              />

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
      </div>

      <div className="space-y-4 lg:col-span-2">
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
