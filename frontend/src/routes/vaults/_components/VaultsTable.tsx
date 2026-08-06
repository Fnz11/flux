import { Link } from '@tanstack/react-router'
import { ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { Vault } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { VaultSparkline } from './VaultSparkline'
import { cn } from '@/lib/utils'

export type SortColumn = 'displayName' | 'pnl' | 'created_at' | 'min_raise_amount' | 'investors' | 'tvl'

interface VaultsTableProps {
  vaults: Vault[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort: (column: SortColumn) => void
}

export function VaultsTable({ vaults, sortBy, sortOrder, onSort }: VaultsTableProps) {
  const renderSortIcon = (column: SortColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-1 inline-block h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 inline-block h-3.5 w-3.5 text-primary-coral" />
    ) : (
      <ArrowDown className="ml-1 inline-block h-3.5 w-3.5 text-primary-coral" />
    )
  }

  const formatMinRaise = (min?: number) => {
    if (!min || min === 0) return '$1 USD'
    return `$${min.toLocaleString()} USD`
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-border-subtle bg-bg-elevated/60 shadow-lg backdrop-blur-md">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border-subtle bg-bg-inset/40 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          <tr>
            <th
              onClick={() => onSort('displayName')}
              className="group cursor-pointer py-4 px-6 select-none hover:text-text-primary transition-colors"
            >
              <div className="flex items-center">
                VAULT {renderSortIcon('displayName')}
              </div>
            </th>
            <th
              onClick={() => onSort('pnl')}
              className={cn(
                'group cursor-pointer py-4 px-4 select-none transition-colors',
                sortBy === 'pnl' ? 'text-primary-coral font-bold' : 'hover:text-text-primary'
              )}
            >
              <div className="flex items-center">
                PNL {renderSortIcon('pnl')}
              </div>
            </th>
            <th
              onClick={() => onSort('created_at')}
              className="group cursor-pointer py-4 px-4 select-none hover:text-text-primary transition-colors"
            >
              <div className="flex items-center">
                CREATED {renderSortIcon('created_at')}
              </div>
            </th>
            <th
              onClick={() => onSort('min_raise_amount')}
              className="group cursor-pointer py-4 px-4 select-none hover:text-text-primary transition-colors"
            >
              <div className="flex items-center">
                MIN {renderSortIcon('min_raise_amount')}
              </div>
            </th>
            <th
              onClick={() => onSort('investors')}
              className="group cursor-pointer py-4 px-4 select-none hover:text-text-primary transition-colors"
            >
              <div className="flex items-center">
                INVESTORS {renderSortIcon('investors')}
              </div>
            </th>
            <th className="py-4 px-4 select-none">ASSET</th>
            <th className="py-4 px-4 select-none">PERFORMANCE</th>
            <th className="py-4 px-6 text-right select-none">ACTION</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {vaults.map((vault) => {
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
              <tr
                key={vault.id}
                className="group hover:bg-bg-elevated/80 transition-colors"
              >
                {/* VAULT */}
                <td className="py-4 px-6 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-coral/20 to-amber-500/20 text-primary-coral font-bold text-sm border border-primary-coral/30">
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary flex items-center gap-2">
                        <span>{displayName}</span>
                        <StatusBadge status={vault.status} />
                      </div>
                      <div className="text-xs text-text-tertiary font-mono">by {managerShort}</div>
                    </div>
                  </div>
                </td>

                {/* PNL */}
                <td className={cn(
                  'py-4 px-4 whitespace-nowrap font-mono font-semibold',
                  isPositivePnl ? 'text-emerald-400' : 'text-rose-400',
                  sortBy === 'pnl' && 'bg-primary-coral/5'
                )}>
                  {isPositivePnl ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
                </td>

                {/* CREATED */}
                <td className="py-4 px-4 whitespace-nowrap text-text-secondary text-xs font-mono">
                  {formatDate(vault.createdAt)}
                </td>

                {/* MIN */}
                <td className="py-4 px-4 whitespace-nowrap font-mono text-text-secondary">
                  {formatMinRaise(vault.minRaiseAmount)}
                </td>

                {/* INVESTORS */}
                <td className="py-4 px-4 whitespace-nowrap font-mono text-text-secondary">
                  {vault.investorCount ?? 0}
                </td>

                {/* ASSET */}
                <td className="py-4 px-4 whitespace-nowrap">
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
                </td>

                {/* Sparkline */}
                <td className="py-4 px-4 whitespace-nowrap">
                  <VaultSparkline isPositive={isPositivePnl} />
                </td>

                {/* ACTION */}
                <td className="py-4 px-6 whitespace-nowrap text-right">
                  <Link
                    to="/vaults/$id"
                    params={{ id: vault.id }}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-bg-inset text-text-secondary hover:text-primary-coral hover:bg-primary-coral/10 border border-border-subtle transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
