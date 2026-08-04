import { useState } from 'react'
import { useWithdraw } from '@/hooks/useWithdraw'
import { usePortfolioStore, useVaultStore } from '@/stores'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SolscanLink } from '@/components/ui/SolscanLink'

interface WithdrawModalProps {
  vaultId: string
  open: boolean
  onClose: () => void
}

export function WithdrawModal({ vaultId, open, onClose }: WithdrawModalProps) {
  const { execute } = useWithdraw()
  const vault = useVaultStore((s) => s.vaults.find((v) => v.id === vaultId))
  const position = usePortfolioStore((s) => s.positions.find((p) => p.vaultId === vaultId))

  const [shareAmount, setShareAmount] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (!open || !position) return null

  const sharePercent = position.sharesOwned > 0
    ? (Number(shareAmount) / position.sharesOwned) * 100
    : 0

  const estimatedValue = position.sharesOwned > 0
    ? (Number(shareAmount) / position.sharesOwned) * position.currentValue
    : 0

  const handleWithdraw = async () => {
    if (!vault || !shareAmount) return
    setLoading(true)
    try {
      const sig = await execute({
        vaultAddress: vault.address,
        shareAmount: Number(shareAmount),
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
    setShareAmount('')
    setSignature(null)
    onClose()
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleClose() }} title="Withdraw">
      <p className="text-sm text-text-tertiary">Available: {position.sharesOwned.toFixed(6)} shares</p>

      <div className="mt-4">
        <Label htmlFor="share-amount" className="mb-1.5 text-xs font-medium">Share Amount</Label>
        <Input
          id="share-amount"
          type="number"
          value={shareAmount}
          onChange={(e) => setShareAmount(e.target.value)}
          placeholder="0.00"
          max={position.sharesOwned}
          className="text-lg font-mono"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShareAmount(String(position.sharesOwned))}
          className="mt-1 h-auto p-0 text-xs text-primary-coral hover:underline"
        >
          Max ({position.sharesOwned.toFixed(6)})
        </Button>
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
            {(position.sharesOwned - Number(shareAmount || 0)).toFixed(6)}
          </span>
        </div>
      </div>

      {signature && (
        <div className="mt-4 rounded-xl border border-border-subtle bg-bg-inset p-3">
          <SolscanLink signature={signature} />
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button variant="outline" onClick={handleClose} className="flex-1">
          {signature ? 'Close' : 'Cancel'}
        </Button>
        {!signature && (
          <Button
            variant="default"
            onClick={handleWithdraw}
            disabled={loading || !shareAmount || Number(shareAmount) <= 0}
            className="flex-1"
          >
            {loading ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
