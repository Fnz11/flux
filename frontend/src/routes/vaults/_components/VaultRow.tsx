import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { Vault } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableRow, TableCell } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useVaultSparklineQuery } from '@/services/hooks/useQuery/useVaultSparklineQuery'
import { VaultSparkline } from './VaultSparkline'
import { cn } from '@/lib/utils'
import { formatDate, formatMinRaise } from './vaultTableUtils'

export interface VaultRowProps {
  vault: Vault
  sortBy?: string
}

export function VaultRow({ vault, sortBy }: VaultRowProps) {
  const { data: sparkline } = useVaultSparklineQuery(vault.id)
  const pnl = vault.pnlPercent ?? 0
  const isPositivePnl = pnl >= 0
  const displayName = vault.metadata.displayName || `Vault ${vault.address.slice(0, 4)}...${vault.address.slice(-4)}`
  const managerShort = vault.managerAddress
    ? `${vault.managerAddress.slice(0, 4)}...${vault.managerAddress.slice(-4)}`
    : 'Unknown Manager'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const focusAssets = vault.metadata.focusAssets && vault.metadata.focusAssets.length > 0
    ? vault.metadata.focusAssets
    : ['SOL', 'USDC']

  return (
    <TableRow
      key={vault.id}
      className="group hover:bg-bg-elevated/80 transition-colors"
    >
      {/* VAULT */}
      <TableCell className="py-4 px-6 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-text-primary flex items-center gap-2">
              <span>{displayName}</span>
              <StatusBadge status={vault.status} />
            </div>
            <div className="text-xs text-text-tertiary font-mono">by {managerShort}</div>
          </div>
        </div>
      </TableCell>

      {/* PNL */}
      <TableCell className={cn(
        'py-4 px-4 whitespace-nowrap font-mono font-semibold',
        isPositivePnl ? 'text-emerald-400' : 'text-rose-400',
        sortBy === 'pnl' && 'bg-primary-coral/5'
      )}>
        {isPositivePnl ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
      </TableCell>

      {/* CREATED */}
      <TableCell className="py-4 px-4 whitespace-nowrap text-text-secondary text-xs font-mono">
        {formatDate(vault.createdAt)}
      </TableCell>

      {/* MIN */}
      <TableCell className="py-4 px-4 whitespace-nowrap font-mono text-text-secondary">
        {formatMinRaise(vault.minRaiseAmount)}
      </TableCell>

      {/* INVESTORS */}
      <TableCell className="py-4 px-4 whitespace-nowrap font-mono text-text-secondary">
        {vault.investorCount ?? 0}
      </TableCell>

      {/* ASSET */}
      <TableCell className="py-4 px-4 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          {focusAssets.slice(0, 3).map((asset) => (
            <span
              key={asset}
              className="inline-flex items-center rounded-md bg-bg-inset px-2 py-0.5 text-xs font-medium text-text-secondary border border-border-subtle"
            >
              {asset}
            </span>
          ))}
        </div>
      </TableCell>

      {/* Sparkline */}
      <TableCell className="py-4 px-4 whitespace-nowrap">
        <VaultSparkline data={sparkline} isPositive={isPositivePnl} />
      </TableCell>

      {/* ACTION */}
      <TableCell className="py-4 px-6 whitespace-nowrap text-right">
        <Link
          to="/vaults/$id"
          params={{ id: vault.id }}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-coral hover:bg-primary-coral/10 transition-colors"
        >
          View
          <ChevronRight className="size-3.5" />
        </Link>
      </TableCell>
    </TableRow>
  )
}
