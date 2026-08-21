import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useWithdraw } from '@/hooks/useWithdraw'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery, usePortfolioQuery } from '@/services/hooks'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { Wallet, Lock } from 'lucide-react'
import { withdrawSchema, type WithdrawFormValues } from '@/validations/invest'
import { getWithdrawEligibility } from '@/lib/eligibility'

interface WithdrawModalProps {
  vaultId: string
  open: boolean
  onClose: () => void
}

const PERCENTAGE_PRESETS = [25, 50, 75, 100] as const

export function WithdrawModal({ vaultId, open, onClose }: WithdrawModalProps) {
  const { execute } = useWithdraw()
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''
  const { data: vaults = [], isLoading: isVaultsLoading } = useVaultsQuery()
  const { data: positions = [], isLoading: isPortfolioLoading } = usePortfolioQuery(walletAddress)

  const vault = vaults.find((v) => v.id === vaultId)
  const position = positions.find((p) => p.vaultId === vaultId)

  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sliderValue, setSliderValue] = useState<number>(0)

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      shareAmount: '',
    },
  })

  const shareAmount = form.watch('shareAmount')
  const numShares = Number(shareAmount) || 0
  const maxShares = position?.sharesOwned || 0

  useEffect(() => {
    if (maxShares > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((numShares / maxShares) * 100)))
      setSliderValue(pct)
    }
  }, [numShares, maxShares])

  const handlePercentageClick = (pct: number) => {
    setSliderValue(pct)
    if (maxShares > 0) {
      const calculated = (maxShares * (pct / 100)).toFixed(6)
      form.setValue('shareAmount', calculated, { shouldValidate: true })
    }
  }

  const handleSliderChange = (val: number) => {
    setSliderValue(val)
    if (maxShares > 0) {
      const calculated = (maxShares * (val / 100)).toFixed(6)
      form.setValue('shareAmount', calculated, { shouldValidate: true })
    }
  }

  if (!open) return null

  const isLoadingData = isVaultsLoading || isPortfolioLoading
  const sharePercent = position && position.sharesOwned > 0
    ? (Number(shareAmount) / position.sharesOwned) * 100
    : 0

  const estimatedValue = position && position.sharesOwned > 0
    ? (Number(shareAmount) / position.sharesOwned) * position.currentValue
    : 0

  const isExceeding = position ? numShares > position.sharesOwned : false
  const withdrawEligibility = getWithdrawEligibility(vault, position, wallet.connected)

  const handleWithdraw = async (data: WithdrawFormValues) => {
    if (!vault || !data.shareAmount || !withdrawEligibility.canExecute) return
    if (position && Number(data.shareAmount) > position.sharesOwned) {
      form.setError('shareAmount', { message: `Amount cannot exceed ${position.sharesOwned.toFixed(6)} shares` })
      return
    }

    setLoading(true)
    try {
      const sig = await execute({
        vaultAddress: vault.address,
        shareAmount: Number(data.shareAmount),
        vaultId,
      })
      setSignature(sig)
    } catch {
      // error handled by store
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    form.reset()
    setSliderValue(0)
    setSignature(null)
    onClose()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
      title="Withdraw"
      footer={
        position && (
          <>
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 h-10 rounded-xl text-xs font-semibold border-white/10 hover:bg-white/5">
              {signature ? 'Close' : 'Cancel'}
            </Button>
            {!signature && (
              <Button
                type="button"
                onClick={form.handleSubmit(handleWithdraw)}
                variant="default"
                disabled={loading || isExceeding || numShares <= 0 || !withdrawEligibility.canExecute}
                title={withdrawEligibility.reason ?? undefined}
                className="flex-1 h-10 rounded-xl text-xs font-bold bg-primary-coral text-white hover:bg-primary-coral/90 shadow-[0_0_20px_rgba(255,107,74,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Withdrawing...'
                  : !withdrawEligibility.canExecute
                    ? (withdrawEligibility.unlockTime ? 'Lockup Active' : 'Cannot Withdraw')
                    : isExceeding
                      ? 'Exceeds Balance'
                      : 'Withdraw'}
              </Button>
            )}
          </>
        )
      }
    >
      {isLoadingData ? (
        <div className="py-2 space-y-4">
          <div className="h-4 w-40 animate-pulse rounded-xl bg-bg-inset" />
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded-xl bg-bg-inset" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-bg-inset" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 flex-1 animate-pulse rounded-xl bg-bg-inset" />
            <div className="h-10 flex-1 animate-pulse rounded-xl bg-bg-inset" />
          </div>
        </div>
      ) : !position ? (
        <EmptyState
          size="sm"
          icon={<Wallet className="size-full" />}
          title="No position found for this vault."
          description="Deposit into this vault to start withdrawing."
        />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleWithdraw)} className="space-y-4 pt-1">
            {!withdrawEligibility.canExecute && (
              <div className="flex items-start gap-2.5 rounded-xl border border-status-warn/25 bg-status-warn/10 p-3 text-xs text-status-warn">
                <Lock className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Withdrawal Locked</p>
                  <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                    {withdrawEligibility.reason}
                  </p>
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-white/12 bg-bg-inset/60 backdrop-blur-md p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-muted">Withdraw Amount</span>
                <div className="flex items-center gap-1.5 text-text-tertiary font-mono text-[11px]">
                  <span>Bal: {position.sharesOwned.toFixed(6)} Shares</span>
                  <button
                    type="button"
                    onClick={() => handlePercentageClick(100)}
                    className="text-primary-coral font-bold hover:underline"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="shareAmount"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <FormControl>
                        <DecimalInput
                          id="withdraw-shares"
                          placeholder="0.00"
                          className="text-2xl sm:text-3xl font-bold font-mono bg-transparent border-0 focus:ring-0 focus:outline-none p-0 text-text-primary placeholder:text-text-muted/40"
                          maxDecimals={6}
                          {...field}
                        />
                      </FormControl>
                      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold font-mono text-text-primary shrink-0">
                        <Wallet className="size-3.5 text-primary-coral" />
                        <span>Shares</span>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-2 text-xs">
              <div className="flex justify-between text-text-tertiary">
                <span className="text-text-muted">Share of vault</span>
                <span className="text-text-primary font-medium">{sharePercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-text-tertiary">
                <span className="text-text-muted">Estimated value</span>
                <span className="text-text-primary font-medium">${estimatedValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-tertiary">
                <span className="text-text-muted">Remaining shares</span>
                <span className="text-text-primary font-medium font-mono">
                  {Math.max(0, position.sharesOwned - Number(shareAmount || 0)).toFixed(6)}
                </span>
              </div>
            </div>

            {signature && (
              <div className="rounded-xl border border-border-subtle bg-bg-inset p-3.5">
                <SolscanLink signature={signature} />
              </div>
            )}
          </form>
        </Form>
      )}
    </Modal>
  )
}

