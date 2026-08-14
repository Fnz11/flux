import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { VaultSparkline } from '../vaults/_components/VaultSparkline'
import { cn } from '@/lib/utils'
import type { Vault } from '@/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d)
}

export function ManagedVaultRow({ vault }: { vault: Vault }) {
  const sparkline = vault.sparkline ?? []
  const pnl = vault.pnlPercent ?? 0
  const isPositive = pnl >= 0
  const displayName = vault.metadata.displayName || `Vault ${vault.address.slice(0, 4)}...${vault.address.slice(-4)}`
  return (
    <TableRow className="hover:bg-bg-elevated/60 transition-colors">
      <TableCell className="py-3.5 px-5 font-semibold text-text-primary whitespace-nowrap text-xs">
        {displayName}
      </TableCell>
      <TableCell className="py-3.5 px-4 whitespace-nowrap">
        <StatusBadge status={vault.status} />
      </TableCell>
      <TableCell className="py-3.5 px-4 font-mono whitespace-nowrap text-xs text-text-primary">
        ${formatCurrency(vault.tvl)}
      </TableCell>
      <TableCell className={cn(
        'py-3.5 px-4 font-mono font-semibold whitespace-nowrap text-xs',
        isPositive ? 'text-emerald-400' : 'text-rose-400'
      )}>
        {isPositive ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
      </TableCell>
      <TableCell className="py-3.5 px-4 font-mono text-xs text-text-tertiary whitespace-nowrap">
        {formatDate(vault.createdAt)}
      </TableCell>
      <TableCell className="py-3.5 px-4 whitespace-nowrap">
        <VaultSparkline data={sparkline} isPositive={isPositive} />
      </TableCell>
      <TableCell className="py-3.5 px-5 text-right whitespace-nowrap">
        <Link
          to="/vaults/$id"
          params={{ id: vault.id }}
          className="inline-flex items-center justify-center size-7 rounded-lg bg-bg-inset text-text-secondary hover:text-primary-coral hover:bg-primary-coral/10 transition-colors border border-border-subtle"
        >
          <ChevronRight className="size-4" />
        </Link>
      </TableCell>
    </TableRow>
  )
}
