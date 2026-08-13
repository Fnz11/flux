import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { useVaultSparklineQuery } from '@/services/hooks/useQuery/useVaultSparklineQuery'
import { VaultSparkline } from '../vaults/_components/VaultSparkline'
import { cn } from '@/lib/utils'
import type { PortfolioPosition } from '@/types'

export function InvestmentRow({ pos }: { pos: PortfolioPosition }) {
  const { data: sparkline } = useVaultSparklineQuery(pos.vaultId)
  const isPositive = pos.pnlPercent >= 0
  return (
    <TableRow className="hover:bg-bg-elevated/60 transition-colors">
      <TableCell className="py-3.5 px-5 font-semibold text-text-primary whitespace-nowrap text-xs">
        {pos.vaultName}
      </TableCell>
      <TableCell className="py-3.5 px-4 font-mono text-xs text-text-secondary whitespace-nowrap">
        {pos.sharesOwned.toFixed(4)}
      </TableCell>
      <TableCell className="py-3.5 px-4 font-mono text-xs text-text-secondary whitespace-nowrap">
        ${pos.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </TableCell>
      <TableCell className="py-3.5 px-4 font-mono text-xs font-semibold text-text-primary whitespace-nowrap">
        ${pos.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </TableCell>
      <TableCell className={cn(
        'py-3.5 px-4 font-mono text-xs font-semibold whitespace-nowrap',
        isPositive ? 'text-emerald-400' : 'text-rose-400'
      )}>
        {isPositive ? `+${pos.pnlPercent.toFixed(2)}%` : `${pos.pnlPercent.toFixed(2)}%`}
      </TableCell>
      <TableCell className="py-3.5 px-4 whitespace-nowrap">
        <VaultSparkline data={sparkline} isPositive={isPositive} />
      </TableCell>
      <TableCell className="py-3.5 px-5 text-right whitespace-nowrap">
        <Link
          to="/vaults/$id"
          params={{ id: pos.vaultId }}
          className="inline-flex items-center justify-center size-7 rounded-lg bg-bg-inset text-text-secondary hover:text-primary-coral hover:bg-primary-coral/10 transition-colors border border-border-subtle"
        >
          <ChevronRight className="size-4" />
        </Link>
      </TableCell>
    </TableRow>
  )
}
