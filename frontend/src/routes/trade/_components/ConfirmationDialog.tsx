import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface ConfirmationDialogProps {
  open: boolean
  onConfirm: () => void
  onClose: () => void
  inputToken: string
  outputToken: string
  inputAmount: number
  outputAmount: number
  rate: number
  slippage: number
  minReceived: number
  networkFee: number
  isLoading: boolean
}

export function ConfirmationDialog({
  open,
  onConfirm,
  onClose,
  inputToken,
  outputToken,
  inputAmount,
  outputAmount,
  rate,
  slippage,
  minReceived,
  networkFee,
  isLoading,
}: ConfirmationDialogProps) {
  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose() }} title="Confirm Trade">
      <div className="mt-4 space-y-3 rounded-xl bg-bg-inset p-4">
          <Row label="Pay" value={`${inputAmount.toFixed(6)} ${inputToken}`} />
          <Row label="Receive" value={`${outputAmount.toFixed(6)} ${outputToken}`} />
          <Row label="Rate" value={`1 ${inputToken} ≈ ${rate.toFixed(6)} ${outputToken}`} />
          <Row label="Slippage" value={`${slippage}%`} />
          <Row label="Min Received" value={`${minReceived.toFixed(6)} ${outputToken}`} />
          <div className="border-t border-border-subtle pt-2">
            <Row label="Network Fee" value={`${networkFee.toFixed(6)} SOL`} />
          </div>
        </div>

        <p className="mt-3 text-xs text-text-tertiary">
          This transaction will be signed by your wallet. Review all details before confirming.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="default" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Confirming...' : 'Confirm Swap'}
          </Button>
        </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-tertiary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  )
}
