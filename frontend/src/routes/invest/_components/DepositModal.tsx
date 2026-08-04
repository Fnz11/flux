import { useVaultStore } from '@/stores'
import { useDepositModal, TOKENS } from '../_hooks/useDepositModal'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SolscanLink } from '@/components/ui/SolscanLink'

interface DepositModalProps {
  vaultId: string
  open: boolean
  onClose: () => void
}

export function DepositModal({ vaultId, open, onClose }: DepositModalProps) {
  const { step, selectedToken, amount, signature, loading, handleConfirm, handleClose, setStep, setSelectedToken, setAmount } = useDepositModal(vaultId)
  const vaultStore = useVaultStore((s) => s.vaults.find((v) => v.id === vaultId))

  const estimatedShares = Number(amount) * (vaultStore?.tvl ? 1 + vaultStore.tvl / 1e6 : 1) || 0

  return (
    <Modal
      open={open}
      onOpenChange={(o) => { if (!o) { handleClose(); onClose() }}}
      title={step === 0 ? 'Deposit' : step === 1 ? 'Confirm Deposit' : 'Deposit Complete'}
    >
      {step === 0 && (
        <>
          <p className="text-sm text-text-tertiary">Select token and amount</p>

          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-muted">Token</p>
              <div className="flex gap-2">
                {TOKENS.map((t) => (
                  <Button
                    key={t.mint}
                    variant={selectedToken.mint === t.mint ? 'default' : 'outline'}
                    onClick={() => setSelectedToken(t)}
                  >
                    {t.symbol}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="deposit-amount" className="mb-1.5 text-xs font-medium">Amount</Label>
              <Input
                id="deposit-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-mono"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => { handleClose(); onClose() }} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => setStep(1)}
              disabled={!amount || Number(amount) <= 0}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <p className="text-sm text-text-tertiary">You will receive approximately</p>

          <div className="mt-6 rounded-xl border border-border-subtle bg-bg-inset p-4">
            <p className="text-center text-3xl font-semibold text-primary-coral font-mono">
              {estimatedShares.toFixed(6)}
            </p>
            <p className="mt-1 text-center text-sm text-text-muted">
              share tokens for {amount} {selectedToken.symbol}
            </p>
          </div>

          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
              Back
            </Button>
            <Button
              variant="default"
              onClick={handleConfirm}
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
            onClick={() => { handleClose(); onClose() }}
            className="mt-6 w-full"
          >
            Done
          </Button>
        </>
      )}
    </Modal>
  )
}
