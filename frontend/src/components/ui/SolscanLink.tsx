import { ExternalLink } from 'lucide-react'
import { SOLSCAN_CLUSTER } from '@/constants'

interface SolscanLinkProps {
  signature: string
  type?: 'tx' | 'address'
  label?: string
  cluster?: 'devnet' | 'mainnet'
}

export function SolscanLink({
  signature,
  type = 'tx',
  label,
  cluster = SOLSCAN_CLUSTER,
}: SolscanLinkProps) {
  const href = `https://solscan.io/${type}/${signature}?cluster=${cluster}`
  const display = label ?? `${signature.slice(0, 8)}...${signature.slice(-8)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 truncate font-mono text-xs text-primary-coral transition-colors hover:text-primary-amber"
    >
      {display}
      <ExternalLink className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
    </a>
  )
}
