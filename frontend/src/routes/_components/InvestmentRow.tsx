import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useVaultSparklineQuery } from '@/services/hooks/useQuery/useVaultSparklineQuery'
import { VaultSparkline } from '../vaults/_components/VaultSparkline'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import type { PortfolioPosition } from '@/types'

export function InvestmentRow({ pos }: { pos: PortfolioPosition }) {
  const { data: sparkline } = useVaultSparklineQuery(pos.vaultId)
  const isPositive = pos.pnlPercent >= 0
  const colorClass = isPositive ? 'text-status-success' : 'text-status-error'

  const initials = pos.vaultName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <TableRow className="group hover:bg-bg-elevated/80 transition-colors">
      <TableCell className="py-4 px-6 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback src={pos.metadata?.coverImageUrl || pos.coverImageUrl} seed={pos.vaultId || pos.vaultName}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-sm flex items-center gap-2 text-text-primary">
              <span>{pos.vaultName}</span>
            </div>
            <div className="mt-0.5">
              <span className="text-xs text-text-tertiary font-mono">Active Position</span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-medium whitespace-nowrap', colorClass)}>
        {pos.sharesOwned.toFixed(4)}
      </TableCell>
      <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-medium whitespace-nowrap', colorClass)}>
        {formatCurrency(pos.totalInvested)}
      </TableCell>
      <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-semibold whitespace-nowrap', colorClass)}>
        {formatCurrency(pos.currentValue)}
      </TableCell>
      <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-semibold whitespace-nowrap', colorClass)}>
        {formatPercent(pos.pnlPercent)}
      </TableCell>
      <TableCell className="py-4 px-4 whitespace-nowrap">
        <VaultSparkline data={sparkline} isPositive={isPositive} />
      </TableCell>
      <TableCell className="py-4 px-6 whitespace-nowrap text-right">
        <Link
          to="/vaults/$id"
          params={{ id: pos.vaultId }}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-coral hover:bg-primary-coral/10 transition-colors"
        >
          View
          <ChevronRight className="size-3.5" />
        </Link>
      </TableCell>
    </TableRow>
  )
}
