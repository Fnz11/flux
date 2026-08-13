import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiFee, Vault } from '@/types'
import { FeeHistory } from '@/routes/payout/_components/FeeHistory'
import { MetricCard } from '@/routes/payout/_components/MetricCard'
import { PayoutSummary } from '@/routes/payout/_components/PayoutSummary'

vi.mock('@/components/ui/select', async () => {
  const ReactModule = await import('react')
  const Context = ReactModule.createContext<any>(null)
  return {
    Select: ({ value, onValueChange, children }: any) => <Context.Provider value={{ value, onValueChange }}>{children}</Context.Provider>,
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => {
      const context = ReactModule.useContext(Context)
      return <select aria-label="vault filter" value={context.value} onChange={(event) => context.onValueChange(event.target.value)}>{children}</select>
    },
    SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
  }
})

const vaults: Vault[] = [{
  id: 'vault-123456789', address: 'address', managerAddress: 'manager', managerId: 'manager-id', status: 'Active',
  metadata: { displayName: 'Alpha Vault', description: '', focusAssets: [] }, performanceFeeBps: 1000,
  managementFeeBps: 200, tvl: 1000, createdAt: '', updatedAt: '',
}]
const fees: ApiFee[] = [{ vault_id: 'vault-123456789', accrued_performance_fee: 12.5, accrued_management_fee: 2.25, total_accrued: 14.75 }]

describe('payout widgets', () => {
  it('renders fee history loading and empty states', () => {
    const props = { filteredFees: [], vaults, selectedVaultId: 'ALL', onSelectVault: vi.fn() }
    const { rerender, container } = render(<FeeHistory {...props} isLoading />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
    rerender(<FeeHistory {...props} isLoading={false} />)
    expect(screen.getByText('No accrued fees recorded yet')).toBeInTheDocument()
  })

  it('renders named vault fees and claim action', () => {
    render(<FeeHistory isLoading={false} filteredFees={fees} vaults={vaults} selectedVaultId="ALL" onSelectVault={vi.fn()} />)
    expect(screen.getAllByText('Alpha Vault').length).toBeGreaterThan(0)
    expect(screen.getByText('$12.50')).toBeInTheDocument()
    expect(screen.getByText('$2.25')).toBeInTheDocument()
    expect(screen.getByText('$14.75')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Claim' })).toBeEnabled()
  })

  it('passes vault filter changes to parent', () => {
    const onSelectVault = vi.fn()
    render(<FeeHistory isLoading={false} filteredFees={fees} vaults={vaults} selectedVaultId="ALL" onSelectVault={onSelectVault} />)
    fireEvent.change(screen.getByLabelText('vault filter'), { target: { value: 'vault-123456789' } })
    expect(onSelectVault).toHaveBeenCalledWith('vault-123456789')
  })

  it('renders metric card accent conditionally', () => {
    const { rerender } = render(<MetricCard label="Available" value="$42.00" accent />)
    expect(screen.getByText('$42.00')).toHaveClass('text-primary-coral')
    rerender(<MetricCard label="Available" value="$42.00" />)
    expect(screen.getByText('$42.00')).toHaveClass('text-text-primary')
  })

  it('formats payout totals and exposes claim-all action', () => {
    render(<PayoutSummary totalPerf={1234.5} totalMgmt={6} totalFees={1240.5} />)
    expect(screen.getByText('$1234')).toBeInTheDocument()
    expect(screen.getByText('$6')).toBeInTheDocument()
    expect(screen.getByText('$1240')).toBeInTheDocument()
    expect(screen.getAllByText('.50')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Claim All' })).toBeEnabled()
  })
})
