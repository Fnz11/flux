'use client'

import { useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { Tooltip } from './tooltip'

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
  className = '',
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
    <div className={`inline-flex items-center ${className}`}>
      <Tooltip content={<span className="break-all font-mono text-xs">{address}</span>}>
        <span className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-border-subtle bg-bg-inset px-3 py-1 font-mono text-xs text-text-tertiary transition-colors hover:text-text-secondary">
          <span className="size-1.5 rounded-full bg-text-muted" />
          {truncated}
        </span>
      </Tooltip>
      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          className="ml-1 flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
          aria-label="Copy address"
        >
          {copied ? <Check className="size-3 text-status-success" /> : <Copy className="size-3" />}
        </button>
      )}
    </div>
  )
}
