import React, { useState, useCallback } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Tooltip } from './tooltip'
import { cn } from '@/lib/utils'
import { SOLSCAN_CLUSTER } from '@/constants'

export interface AddressPillProps {
  address: string
  prefix?: string
  length?: number
  showDot?: boolean
  showCopy?: boolean
  showExplorer?: boolean
  className?: string
}

export function AddressPill({
  address,
  prefix = '',
  length = 4,
  showDot = true,
  showCopy = true,
  showExplorer = true,
  className,
}: AddressPillProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (!address || address === 'N/A') return
      try {
        await navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // fallback handled silently
      }
    },
    [address]
  )

  if (!address || address === 'N/A') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-bg-inset/80 px-2.5 py-0.5 font-mono text-xs text-text-muted',
          className
        )}
      >
        {prefix}N/A
      </span>
    )
  }

  const truncated =
    address.length > length * 2 + 3
      ? `${address.slice(0, length)}...${address.slice(-length)}`
      : address

  const explorerUrl = `https://solscan.io/account/${address}?cluster=${SOLSCAN_CLUSTER}`

  return (
    <Tooltip content={<span className="break-all font-mono text-xs">{address}</span>}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] hover:bg-white/[0.08] px-2.5 py-0.5 font-mono text-xs font-medium text-text-primary transition-all duration-150 select-none shadow-sm',
          className
        )}
      >
        {showDot && (
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
        )}
        <span className="tracking-tight">
          {prefix}{truncated}
        </span>
        {showCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className="ml-0.5 inline-flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors cursor-pointer rounded p-0.5"
            aria-label={copied ? 'Copied address' : 'Copy address'}
            title={copied ? 'Copied!' : 'Copy address'}
          >
            {copied ? (
              <Check className="size-3 text-emerald-400" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        )}
        {showExplorer && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center text-text-tertiary hover:text-text-primary transition-colors cursor-pointer rounded p-0.5"
            aria-label="Open in Solana explorer"
            title="Open in Solana explorer"
          >
            <ExternalLink className="size-3" />
          </a>
        )}
      </span>
    </Tooltip>
  )
}
