import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { usePortfolioStore } from '@/stores'
import { SectionCard } from '@/components/ui/SectionCard'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { Layers, HelpCircle } from 'lucide-react'
import { InvestmentRow } from './InvestmentRow'
import { useTableSort } from '@/hooks/useTableSort'

type PositionSortColumn = 'vaultName' | 'sharesOwned' | 'totalInvested' | 'currentValue' | 'pnlPercent'

export function InvestorVaultsList({ walletAddress: _walletAddress }: { walletAddress?: string }) {
  const positions = usePortfolioStore((s) => s.positions)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const { sortBy, sortOrder, handleSort } = useTableSort<PositionSortColumn>({
    sortBy: 'currentValue',
    defaultOrder: 'desc',
    allowClear: true,
  })

  const sortedInvestments = useMemo(() => {
    if (!sortBy || !sortOrder) return positions

    return [...positions].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'vaultName':
          aVal = a.vaultName.toLowerCase()
          bVal = b.vaultName.toLowerCase()
          break
        case 'sharesOwned':
          aVal = a.sharesOwned || 0
          bVal = b.sharesOwned || 0
          break
        case 'totalInvested':
          aVal = a.totalInvested || 0
          bVal = b.totalInvested || 0
          break
        case 'currentValue':
          aVal = a.currentValue || 0
          bVal = b.currentValue || 0
          break
        case 'pnlPercent':
          aVal = a.pnlPercent || 0
          bVal = b.pnlPercent || 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [positions, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(sortedInvestments.length / pageSize))
  const paged = sortedInvestments.slice((page - 1) * pageSize, page * pageSize)

  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-gold" />}
      title="My Active Investments"
      description="Vault shares and real-time NAV positions"
      className="flex-1 flex flex-col justify-between"
    >
      <Table
        className="min-w-[640px]"
        containerClassName="min-h-[400px]"
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={sortedInvestments.length}
            pageSize={pageSize}
            pageSizeOptions={[5, 8, 15, 30]}
            onPageChange={setPage}
            onPageSizeChange={(newSize: number) => {
              setPageSize(newSize)
              setPage(1)
            }}
            itemLabel="positions"
          />
        }
      >
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="vaultName"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              className="py-3 px-6"
            >
              VAULT NAME
            </SortableTableHead>
            <SortableTableHead
              column="sharesOwned"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
              className="py-3 px-4"
            >
              SHARES
            </SortableTableHead>
            <SortableTableHead
              column="totalInvested"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
              className="py-3 px-4"
            >
              INVESTED
            </SortableTableHead>
            <SortableTableHead
              column="currentValue"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
              className="py-3 px-4"
            >
              CURRENT VALUE
            </SortableTableHead>
            <SortableTableHead
              column="pnlPercent"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
              className="py-3 px-4"
            >
              PNL
            </SortableTableHead>
            <TableHead className="py-3 px-4 select-none">PERFORMANCE</TableHead>
            <TableHead className="py-3 px-6 text-right select-none">ACTION</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.length === 0 ? (
            <TableEmpty
              colSpan={7}
              icon={<HelpCircle className="size-5" />}
              title="No Active Investments"
              description="Deposit into top-performing Solana vaults to earn yields managed by pros."
              minHeight="min-h-[300px]"
              action={
                <Link to="/vaults">
                  <span className="inline-flex items-center justify-center rounded-lg bg-primary-coral px-4 py-2 text-xs font-bold text-white hover:bg-primary-coral/90 transition-colors shadow-md cursor-pointer">
                    Explore Vaults
                  </span>
                </Link>
              }
            />
          ) : (
            paged.map((pos) => (
              <InvestmentRow key={pos.vaultId} pos={pos} />
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
