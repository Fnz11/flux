import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { usePortfolioStore } from '@/stores'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table'
import { Layers, HelpCircle, ArrowUpDown } from 'lucide-react'
import { InvestmentRow } from './InvestmentRow'

export function InvestorVaultsList({ walletAddress: _walletAddress }: { walletAddress?: string }) {
  const positions = usePortfolioStore((s) => s.positions)
  const [sortBy, setSortBy] = useState<'currentValue' | 'pnlPercent'>('currentValue')

  const sortedInvestments = [...positions].sort((a, b) => {
    if (sortBy === 'currentValue') return b.currentValue - a.currentValue
    return b.pnlPercent - a.pnlPercent
  })

  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-gold" />}
      title="My Active Investments"
      description="Vault shares and real-time NAV positions"
      rightContent={
        positions.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortBy(sortBy === 'currentValue' ? 'pnlPercent' : 'currentValue')}
              className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-inset px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            >
              <ArrowUpDown className="size-3.5 text-primary-gold" />
              <span>Sort: {sortBy === 'currentValue' ? 'Value' : 'PNL'}</span>
            </button>
          </div>
        )
      }
    >
      {positions.length === 0 ? (
        <div className="rounded-xl border border-border-subtle/50 bg-bg-inset/40 p-4">
          <EmptyState
            icon={<HelpCircle className="size-5" />}
            title="No Active Investments"
            description="Deposit into top-performing Solana vaults to earn yields managed by pros."
            size="md"
          />
          <div className="mt-2 flex justify-center">
            <Link to="/vaults">
              <span className="inline-flex items-center justify-center rounded-lg bg-primary-coral px-4 py-2 text-xs font-bold text-white hover:bg-primary-coral/90 transition-colors shadow-md">
                Explore Vaults
              </span>
            </Link>
          </div>
        </div>
      ) : (
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="py-3 px-5">VAULT NAME</TableHead>
              <TableHead className="py-3 px-4">SHARES</TableHead>
              <TableHead className="py-3 px-4">INVESTED</TableHead>
              <TableHead className="py-3 px-4">CURRENT VALUE</TableHead>
              <TableHead className="py-3 px-4">PNL</TableHead>
              <TableHead className="py-3 px-4">PERFORMANCE</TableHead>
              <TableHead className="py-3 px-5 text-right">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedInvestments.map((pos) => (
              <InvestmentRow key={pos.vaultId} pos={pos} />
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
