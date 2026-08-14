import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useWithdraw } from '@/hooks/useWithdraw'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery, usePortfolioQuery } from '@/services/hooks'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { Wallet } from 'lucide-react'
import { withdrawSchema, type WithdrawFormValues } from '@/validations/invest'

interface WithdrawModalProps {
  vaultId: string
  open: boolean
  onClose: () => void
}

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

  const form = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: {
      shareAmount: '',
    },
  })

  if (!open) return null

  const isLoadingData = isVaultsLoading || isPortfolioLoading
  const shareAmount = form.watch('shareAmount')

  const sharePercent = position && position.sharesOwned > 0
    ? (Number(shareAmount) / position.sharesOwned) * 100
    : 0

  const estimatedValue = position && position.sharesOwned > 0
    ? (Number(shareAmount) / position.sharesOwned) * position.currentValue
    : 0

  const handleWithdraw = async (data: WithdrawFormValues) => {
    if (!vault || !data.shareAmount) return
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
    setSignature(null)
    onClose()
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleClose() }} title="Withdraw">
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
          <form onSubmit={form.handleSubmit(handleWithdraw)}>
            <p className="text-sm text-text-tertiary">Available: {position.sharesOwned.toFixed(6)} shares</p>

            <div className="mt-4">
              <FormField
                control={form.control}
                name="shareAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1.5 text-xs font-medium">Share Amount</FormLabel>
                    <FormControl>
                      <DecimalInput
                        id="share-amount"
                        placeholder="0.00"
                        className="text-lg font-mono"
                        maxDecimals={6}
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => form.setValue('shareAmount', String(position.sharesOwned), { shouldValidate: true })}
                      className="mt-1 h-auto p-0 text-xs text-primary-coral hover:underline"
                    >
                      Max ({position.sharesOwned.toFixed(6)})
                    </Button>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-4 rounded-xl border border-border-subtle bg-bg-inset p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Share of vault</span>
                <span className="text-text-primary font-medium">{sharePercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Estimated value</span>
                <span className="text-text-primary font-medium">${estimatedValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Remaining shares</span>
                <span className="text-text-primary font-medium font-mono">
                  {Math.max(0, position.sharesOwned - Number(shareAmount || 0)).toFixed(6)}
                </span>
              </div>
            </div>

            {signature && (
              <div className="mt-4 rounded-xl border border-border-subtle bg-bg-inset p-3">
                <SolscanLink signature={signature} />
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                {signature ? 'Close' : 'Cancel'}
              </Button>
              {!signature && (
                <Button
                  type="submit"
                  variant="default"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Withdrawing...' : 'Withdraw'}
                </Button>
              )}
            </div>
          </form>
        </Form>
      )}
    </Modal>
  )
}

