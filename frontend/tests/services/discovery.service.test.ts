import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import {
  createNotification,
  getNotifications,
  markAllNotificationsRead,
} from '@/services/apis/rest-api/notification.service'
import { search } from '@/services/apis/rest-api/search.service'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('search service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('encodes query text and includes role and limit', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ kind: 'pairs', items: [] })

    await search({ q: 'SOL / USDC + BTC', role: 'manager', limit: 10 })

    expect(api.get).toHaveBeenCalledWith('/search?q=SOL+%2F+USDC+%2B+BTC&role=manager&limit=10')
  })

  it('omits a zero limit', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ kind: 'pairs', items: [] })

    await search({ q: 'SOL', role: 'manager', limit: 0 })

    expect(api.get).toHaveBeenCalledWith('/search?q=SOL&role=manager')
  })

  it('maps pair results and defaults missing symbols', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ kind: 'pairs', items: [{ symbol: 'SOL/USDC' }, {}] })

    await expect(search({ q: 'sol', role: 'manager' })).resolves.toEqual({
      kind: 'pairs',
      items: [{ symbol: 'SOL/USDC' }, { symbol: '' }],
    })
  })

  it('maps vault results and defaults malformed fields', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      kind: 'vaults',
      items: [{ id: 'v1', address: 'a1', display_name: 'Alpha', tvl: 42 }, {}],
    })

    await expect(search({ q: 'alpha', role: 'investor' })).resolves.toEqual({
      kind: 'vaults',
      items: [
        { id: 'v1', address: 'a1', displayName: 'Alpha', tvl: 42 },
        { id: '', address: '', displayName: '', tvl: 0 },
      ],
    })
  })
})

describe('notification service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('omits the query marker when no filters are present', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ items: [], total: 0, unread: 0 })

    await getNotifications()

    expect(api.get).toHaveBeenCalledWith('/notifications')
  })

  it('includes truthy filters and omits false and zero values', async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [], total: 0, unread: 0 })

    await getNotifications({ unread: true, page: 2, limit: 25 })
    expect(api.get).toHaveBeenLastCalledWith('/notifications?unread=true&page=2&limit=25')

    await getNotifications({ unread: false, page: 0, limit: 0 })
    expect(api.get).toHaveBeenLastCalledWith('/notifications')
  })

  it('maps notification fields and defaults missing envelope values', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      items: [{ id: 'n1', type: 'trade', title: 'Filled', message: 'Done', read: false, created_at: '2026-01-01' }],
    })

    await expect(getNotifications()).resolves.toEqual({
      items: [{ id: 'n1', type: 'trade', title: 'Filled', message: 'Done', read: false, createdAt: '2026-01-01' }],
      total: 0,
      unread: 0,
    })
  })

  it('posts notification creation and mark-all-read payloads', async () => {
    const input = { type: 'system', title: 'Notice', message: 'Hello' }
    vi.mocked(api.post)
      .mockResolvedValueOnce({ ...input, id: 'n2', read: false, created_at: '2026-01-02' })
      .mockResolvedValueOnce(undefined)

    await expect(createNotification(input)).resolves.toMatchObject({ id: 'n2', createdAt: '2026-01-02' })
    await expect(markAllNotificationsRead()).resolves.toBeUndefined()
    expect(api.post).toHaveBeenNthCalledWith(1, '/notifications', input)
    expect(api.post).toHaveBeenNthCalledWith(2, '/notifications/read', {})
  })
})
