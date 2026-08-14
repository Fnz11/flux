import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { useDepositModal } from '../_hooks/useDepositModal'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { depositSchema, type DepositFormValues } from '@/validations/invest'
import { CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react'

interface DepositModalProps {
  vaultId: string
  open: boolean
  onClose: () => void
}

const PERCENTAGE_PRESETS = [25, 50, 75, 100] as const

export function DepositModal({ vaultId, open, onClose }: DepositModalProps) {
  const {
    step,
    selectedToken,
    signature,
    loading,
    availableTokens,
    handleConfirm,
    handleClose,
    setStep,
    setSelectedToken,
    setAmount,
  } = useDepositModal(vaultId)

  const { data: vaults = [] } = useVaultsQuery()
  const vaultStore = vaults.find((v) => v.id === vaultId)

  const wallet = useWallet()
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [sliderValue, setSliderValue] = useState<number>(0)

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: '',
    },
  })

  const amountWatch = form.watch('amount')
  const numAmount = Number(amountWatch) || 0
  const estimatedShares = numAmount * (vaultStore?.tvl ? 1 + vaultStore.tvl / 1e6 : 1) || 0

  // Sync slider when amount changes manually
  useEffect(() => {
    if (tokenBalance && tokenBalance > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((numAmount / tokenBalance) * 100)))
      setSliderValue(pct)
    }
  }, [numAmount, tokenBalance])

  const handlePercentageClick = (pct: number) => {
    setSliderValue(pct)
    if (tokenBalance && tokenBalance > 0) {
      const calculated = (tokenBalance * (pct / 100)).toFixed(selectedToken.decimals === 9 ? 4 : 2)
      form.setValue('amount', calculated, { shouldValidate: true })
    } else {
      // If no live balance connected, set standard proportional presets
      const base = 10
      const calculated = ((base * pct) / 100).toString()
      form.setValue('amount', calculated, { shouldValidate: true })
    }
  }

  const handleSliderChange = (val: number) => {
    setSliderValue(val)
    if (tokenBalance && tokenBalance > 0) {
      const calculated = (tokenBalance * (val / 100)).toFixed(selectedToken.decimals === 9 ? 4 : 2)
      form.setValue('amount', calculated, { shouldValidate: true })
    }
  }

  const resetModalState = () => {
    form.reset()
    setSliderValue(0)
    handleClose()
    onClose()
  }

  const onNextStep = form.handleSubmit((data) => {
    setAmount(data.amount)
    setStep(1)
  })

  const onConfirm = () => {
    handleConfirm()
  }

  const displayName = vaultStore?.metadata?.displayName || `Vault ${vaultId.slice(0, 8)}`

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) resetModalState()
      }}
      title={step === 0 ? 'Deposit' : step === 1 ? 'Confirm Deposit' : 'Deposit Complete'}
    >
      {step === 0 && (
        <Form {...form}>
          <form onSubmit={onNextStep} className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-tertiary">
                Deposit liquidity into <span className="font-semibold text-text-primary">{displayName}</span>
              </p>
              <div className="flex items-center gap-1 text-[11px] text-primary-coral font-mono">
                <ShieldCheck className="size-3.5" />
                <span>Non-Custodial</span>
              </div>
            </div>

            {/* Token Selector based on Vault Supported Assets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-secondary">Supported Deposit Assets</span>
                <span className="text-[11px] text-text-muted">{availableTokens.length} assets available</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableTokens.map((t) => {
                  const isSelected = selectedToken.symbol === t.symbol || selectedToken.mint === t.mint
                  return (
                    <Button
                      key={t.mint || t.symbol}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => {
                        setSelectedToken(t)
                        setSliderValue(0)
                      }}
                      className={`h-9 px-3 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${
                        isSelected
                          ? 'bg-primary-coral text-white border-primary-coral shadow-[0_0_16px_rgba(255,107,74,0.35)]'
                          : 'border-white/10 bg-white/[0.03] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary'
                      }`}
                    >
                      <TokenIcon symbol={t.symbol} alt="" className="size-4 shrink-0" />
                      <span>{t.symbol}</span>
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Amount Input Glass Card */}
            <div className="rounded-2xl border border-white/12 bg-bg-inset/60 backdrop-blur-md p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-muted">Deposit Amount</span>
                {tokenBalance !== null ? (
                  <div className="flex items-center gap-1.5 text-text-tertiary font-mono text-[11px]">
                    <span>Bal: {tokenBalance.toFixed(3)} {selectedToken.symbol}</span>
                    <button
                      type="button"
                      onClick={() => handlePercentageClick(100)}
                      className="text-primary-coral font-bold hover:underline"
                    >
                      MAX
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-text-muted font-mono">{selectedToken.symbol}</span>
                )}
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <FormControl>
                        <DecimalInput
                          id="deposit-amount"
                          placeholder="0.00"
                          className="text-2xl sm:text-3xl font-bold font-mono bg-transparent border-0 focus:ring-0 focus:outline-none p-0 text-text-primary placeholder:text-text-muted/40"
                          maxDecimals={selectedToken.decimals || 9}
                          {...field}
                        />
                      </FormControl>
                      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold font-mono text-text-primary shrink-0">
                        <TokenIcon symbol={selectedToken.symbol} className="size-3.5" />
                        <span>{selectedToken.symbol}</span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Slider & Percentage Presets */}
              <div className="space-y-2 pt-1 border-t border-white/5">
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>Allocation</span>
                  <span className="font-mono text-primary-coral font-semibold">{sliderValue}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={sliderValue}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-coral focus:outline-none"
                />
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {PERCENTAGE_PRESETS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handlePercentageClick(pct)}
                      className={`py-1 text-[11px] font-mono rounded-lg border transition-all ${
                        sliderValue === pct
                          ? 'border-primary-coral/40 bg-primary-coral/15 text-primary-coral font-bold'
                          : 'border-white/8 bg-white/[0.02] text-text-muted hover:text-text-primary hover:bg-white/[0.06]'
                      }`}
                    >
                      {pct === 100 ? 'MAX' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Estimated Output Feedback */}
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-text-tertiary text-[11px]">Estimated Shares Received</span>
                <p className="font-mono text-sm font-bold text-primary-coral">
                  {estimatedShares > 0 ? estimatedShares.toFixed(6) : '0.000000'} Shares
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-text-tertiary text-[11px]">Deposit Fee</span>
                <p className="font-mono text-xs font-semibold text-status-success">0.00% (Free)</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={resetModalState}
                className="flex-1 h-10 rounded-xl text-xs font-semibold border-white/10 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="flex-1 h-10 rounded-xl text-xs font-bold bg-primary-coral text-white hover:bg-primary-coral/90 shadow-[0_0_20px_rgba(255,107,74,0.3)] flex items-center justify-center gap-1.5"
              >
                <span>Next</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </form>
        </Form>
      )}

      {step === 1 && (
        <div className="space-y-5 pt-1">
          <p className="text-xs text-text-tertiary">
            Review your deposit allocation and sign transaction with your wallet.
          </p>

          <div className="rounded-2xl border border-white/12 bg-bg-inset/70 backdrop-blur-md p-5 text-center space-y-2 shadow-inner">
            <p className="text-xs text-text-tertiary uppercase tracking-wider font-semibold">
              You will receive approximately
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-primary-coral font-mono tracking-tight">
              {estimatedShares.toFixed(6)}
            </p>
            <p className="text-xs text-text-secondary flex items-center justify-center gap-1.5 font-medium">
              <span>share tokens for {amountWatch} {selectedToken.symbol}</span>
              <TokenIcon symbol={selectedToken.symbol} alt="" className="size-4 shrink-0" />
            </p>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2 text-xs">
            <div className="flex justify-between text-text-tertiary">
              <span>Vault Strategy</span>
              <span className="font-semibold text-text-primary">{displayName}</span>
            </div>
            <div className="flex justify-between text-text-tertiary">
              <span>Deposit Asset</span>
              <span className="font-mono text-text-primary">{amountWatch} {selectedToken.symbol}</span>
            </div>
            <div className="flex justify-between text-text-tertiary">
              <span>Performance Fee</span>
              <span className="font-mono text-text-primary">{((vaultStore?.performanceFeeBps || 0) / 100).toFixed(2)}%</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              onClick={() => setStep(0)}
              className="flex-1 h-10 rounded-xl text-xs font-semibold border-white/10 hover:bg-white/5"
            >
              Back
            </Button>
            <Button
              variant="default"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 h-10 rounded-xl text-xs font-bold bg-primary-coral text-white hover:bg-primary-coral/90 shadow-[0_0_20px_rgba(255,107,74,0.3)]"
            >
              {loading ? 'Confirming...' : 'Confirm & Sign'}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 pt-1 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-success/15 border border-status-success/30 text-status-success">
            <CheckCircle2 className="size-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-text-primary">Deposit Confirmed</h3>
            <p className="text-xs text-text-tertiary">
              Transaction broadcast and confirmed on Solana mainnet.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-inset p-3.5">
            {signature && <SolscanLink signature={signature} />}
          </div>

          <Button
            variant="default"
            onClick={resetModalState}
            className="w-full h-10 rounded-xl text-xs font-bold bg-primary-coral text-white hover:bg-primary-coral/90 shadow-[0_0_20px_rgba(255,107,74,0.3)]"
          >
            Done
          </Button>
        </div>
      )}
    </Modal>
  )
}
