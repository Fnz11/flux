import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchAutocomplete } from '@/components/ui/SearchAutocomplete'
import { NotificationsPopover } from '@/components/ui/NotificationsPopover'
import type { Notification, SearchResults } from '@/types'

const notificationMocks = vi.hoisted(() => ({
  state: { items: [] as Notification[], unread: 0, isLoading: false },
  fetch: vi.fn(),
  markAllRead: vi.fn(),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
vi.mock('@/stores/notification-store', () => ({
  useNotificationStore: Object.assign(
    (selector: (state: typeof notificationMocks.state) => unknown) => selector(notificationMocks.state),
    { getState: () => ({ ...notificationMocks.state, fetch: notificationMocks.fetch, markAllRead: notificationMocks.markAllRead }) },
  ),
}))

const pairResults: SearchResults = { kind: 'pairs', items: [{ symbol: 'SOL/USDC' }, { symbol: 'BTC/USDC' }] }
const vaultResults: SearchResults = {
  kind: 'vaults',
  items: [{ id: 'v1', displayName: 'Alpha Vault', address: '1234567890abcdefghijklmnop', tvl: 100 }],
}

function renderSearch(overrides: Partial<React.ComponentProps<typeof SearchAutocomplete>> = {}) {
  const props = {
    query: '',
    setQuery: vi.fn(),
    open: true,
    setOpen: vi.fn(),
    loading: false,
    results: null,
    onSelect: vi.fn(),
    ...overrides,
  }
  render(<SearchAutocomplete {...props} />)
  return props
}

describe('SearchAutocomplete', () => {
  it('opens from the search trigger', () => {
    const props = renderSearch({ open: false })
    fireEvent.click(screen.getByRole('button', { name: /search asset/i }))
    expect(props.setOpen).toHaveBeenCalledWith(true)
  })

  it('opens from the Ctrl+K shortcut', () => {
    const props = renderSearch({ open: false })
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(props.setOpen).toHaveBeenCalledWith(true)
  })

  it('forwards typing without selecting a result', () => {
    const props = renderSearch()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'SOL' } })
    expect(props.setQuery).toHaveBeenCalledWith('SOL')
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('shows loading state', () => {
    renderSearch({ query: 'SOL', loading: true })
    expect(screen.getByText('Searching ecosystem...')).toBeInTheDocument()
  })

  it('shows initial and empty-result guidance', () => {
    const { rerender } = render(<SearchAutocomplete query="" setQuery={vi.fn()} open setOpen={vi.fn()} loading={false} results={null} onSelect={vi.fn()} />)
    expect(screen.getByText(/type a symbol/i)).toBeInTheDocument()
    rerender(<SearchAutocomplete query="XYZ" setQuery={vi.fn()} open setOpen={vi.fn()} loading={false} results={{ kind: 'pairs', items: [] }} onSelect={vi.fn()} />)
    expect(screen.getByText(/no matching assets.*"XYZ"/i)).toBeInTheDocument()
  })

  it('renders pair results and selects one by click', () => {
    const props = renderSearch({ query: 'USD', results: pairResults })
    fireEvent.click(screen.getByRole('button', { name: /BTC\/USDC/i }))
    expect(props.onSelect).toHaveBeenCalledWith({ symbol: 'BTC/USDC' }, 'pairs')
  })

  it('renders vault results with a truncated address', () => {
    renderSearch({ query: 'Alpha', results: vaultResults })
    expect(screen.getByText('Alpha Vault')).toBeInTheDocument()
    expect(screen.getByText('12345678…ijklmnop')).toBeInTheDocument()
  })

  it('navigates results with arrows and selects with Enter', () => {
    const props = renderSearch({ query: 'USD', results: pairResults })
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(props.onSelect).toHaveBeenCalledWith({ symbol: 'BTC/USDC' }, 'pairs')
  })
})

describe('NotificationsPopover', () => {
  beforeEach(() => {
    notificationMocks.state = { items: [], unread: 0, isLoading: false }
    notificationMocks.fetch.mockReset()
    notificationMocks.markAllRead.mockReset()
  })

  it('toggles from the notification button', () => {
    const onToggle = vi.fn()
    render(<NotificationsPopover open={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByTitle('Notifications'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('fetches and shows empty state when opened', async () => {
    render(<NotificationsPopover open onToggle={vi.fn()} />)
    expect(screen.getByText('No notifications yet')).toBeInTheDocument()
    await waitFor(() => expect(notificationMocks.fetch).toHaveBeenCalledOnce())
  })

  it('shows loading state', () => {
    notificationMocks.state.isLoading = true
    render(<NotificationsPopover open onToggle={vi.fn()} />)
    expect(screen.getByText('Loading notifications...')).toBeInTheDocument()
  })

  it('renders populated notifications and unread badge', () => {
    notificationMocks.state = {
      unread: 2,
      isLoading: false,
      items: [{ id: '1', type: 'trade', title: 'Trade complete', message: 'SOL purchased', read: false, createdAt: new Date().toISOString() }],
    }
    render(<NotificationsPopover open onToggle={vi.fn()} />)
    expect(screen.getByText('Trade complete')).toBeInTheDocument()
    expect(screen.getByText('SOL purchased')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('caps the unread badge at 9+', () => {
    notificationMocks.state.unread = 12
    render(<NotificationsPopover open={false} onToggle={vi.fn()} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('marks all notifications read', () => {
    notificationMocks.state.unread = 1
    render(<NotificationsPopover open onToggle={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }))
    expect(notificationMocks.markAllRead).toHaveBeenCalledOnce()
  })

  it('renders a notification injected through the mocked WS/store boundary', () => {
    const view = render(<NotificationsPopover open onToggle={vi.fn()} />)
    notificationMocks.state = {
      unread: 1,
      isLoading: false,
      items: [{ id: 'ws-1', type: 'notification', title: 'WS update', message: 'Vault changed', read: false, createdAt: new Date().toISOString() }],
    }
    view.rerender(<NotificationsPopover open onToggle={vi.fn()} />)
    expect(screen.getByText('WS update')).toBeInTheDocument()
  })
})
