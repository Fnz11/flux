import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { useDepositModal, TOKENS } from '../_hooks/useDepositModal'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { depositSchema, type DepositFormValues } from '@/validations/invest'

interface DepositModalProps {
  vaultId: string
  open: boolean
  onClose: () => void
}

export function DepositModal({ vaultId, open, onClose }: DepositModalProps) {
  const { step, selectedToken, signature, loading, handleConfirm, handleClose, setStep, setSelectedToken, setAmount } = useDepositModal(vaultId)
  const { data: vaults = [] } = useVaultsQuery()
  const vaultStore = vaults.find((v) => v.id === vaultId)

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: '',
    },
  })

  const amountWatch = form.watch('amount')
  const estimatedShares = Number(amountWatch) * (vaultStore?.tvl ? 1 + vaultStore.tvl / 1e6 : 1) || 0

  const resetModalState = () => {
    form.reset()
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

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) resetModalState() }}
      title={step === 0 ? 'Deposit' : step === 1 ? 'Confirm Deposit' : 'Deposit Complete'}
    >
      {step === 0 && (
        <Form {...form}>
          <form onSubmit={onNextStep}>
            <p className="text-sm text-text-tertiary">Select token and amount</p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-muted">Token</p>
                <div className="flex flex-wrap gap-2">
                  {TOKENS.map((t) => (
                    <Button
                      key={t.mint}
                      type="button"
                      variant={selectedToken.mint === t.mint ? 'default' : 'outline'}
                      onClick={() => setSelectedToken(t)}
                      className="flex items-center gap-1.5"
                    >
                      <TokenIcon symbol={t.symbol} alt="" className="size-4" />
                      <span>{t.symbol}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1.5 text-xs font-medium">Amount</FormLabel>
                    <FormControl>
                      <DecimalInput
                        id="deposit-amount"
                        placeholder="0.00"
                        className="text-lg font-mono"
                        maxDecimals={9}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={resetModalState} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="flex-1"
              >
                Next
              </Button>
            </div>
          </form>
        </Form>
      )}

      {step === 1 && (
        <>
          <p className="text-sm text-text-tertiary">You will receive approximately</p>

          <div className="mt-6 rounded-xl border border-border-subtle bg-bg-inset p-4">
            <p className="text-center text-3xl font-semibold text-primary-coral font-mono">
              {estimatedShares.toFixed(6)}
            </p>
            <p className="mt-1 text-center text-sm text-text-muted flex items-center justify-center gap-1.5">
              <span>share tokens for {amountWatch} {selectedToken.symbol}</span>
              <TokenIcon symbol={selectedToken.symbol} alt="" className="size-3.5" />
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
              Back
            </Button>
            <Button
              variant="default"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Confirming...' : 'Confirm & Sign'}
            </Button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <p className="text-sm text-text-tertiary">Transaction broadcast to Solana</p>

          <div className="mt-6 rounded-xl border border-border-subtle bg-bg-inset p-4">
            {signature && <SolscanLink signature={signature} />}
          </div>

          <Button
            variant="default"
            onClick={resetModalState}
            className="mt-6 w-full"
          >
            Done
          </Button>
        </>
      )}
    </Modal>
  )
}
