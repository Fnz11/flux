import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { ConfirmationRow } from './ConfirmationRow'

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
        <ConfirmationRow
          label="Pay"
          value={
            <>
              <TokenIcon symbol={inputToken} className="size-4" />
              <span>{inputAmount.toFixed(6)} {inputToken}</span>
            </>
          }
        />
        <ConfirmationRow
          label="Receive"
          value={
            <>
              <TokenIcon symbol={outputToken} className="size-4" />
              <span>{outputAmount.toFixed(6)} {outputToken}</span>
            </>
          }
        />
        <ConfirmationRow
          label="Rate"
          value={
            <span>1 {inputToken} ≈ {rate.toFixed(6)} {outputToken}</span>
          }
        />
        <ConfirmationRow label="Slippage" value={`${slippage}%`} />
        <ConfirmationRow
          label="Min Received"
          value={
            <>
              <TokenIcon symbol={outputToken} className="size-4" />
              <span>{minReceived.toFixed(6)} {outputToken}</span>
            </>
          }
        />
        <div className="border-t border-border-subtle pt-2">
          <ConfirmationRow
            label="Network Fee"
            value={
              <>
                <TokenIcon symbol="SOL" className="size-4" />
                <span>{networkFee.toFixed(6)} SOL</span>
              </>
            }
          />
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
