import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { Tooltip } from './tooltip'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface AddressPillProps {
  address: string
  length?: number
  showCopy?: boolean
  className?: string
}

export function AddressPill({
  address,
  length = 4,
  showCopy = false,
  className,
}: AddressPillProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback handled silently
    }
  }, [address])

  const truncated = `${address.slice(0, length)}...${address.slice(-length)}`

  return (
    <div className={cn('inline-flex items-center', className)}>
      <Tooltip content={<span className="break-all font-mono text-xs">{address}</span>}>
        <span className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border-medium bg-bg-inset/80 px-2.5 py-0.5 font-mono text-[11px] font-medium text-text-primary transition-colors hover:bg-bg-inset">
          <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
          {truncated}
        </span>
      </Tooltip>
      {showCopy && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="ml-1 size-5 rounded text-text-muted hover:text-text-primary"
          aria-label="Copy address"
        >
          {copied ? <Check className="size-3 text-status-success" /> : <Copy className="size-3" />}
        </Button>
      )}
    </div>
  )
}
