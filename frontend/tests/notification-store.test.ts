import { describe, it, beforeEach } from 'vitest'
import assert from 'node:assert/strict'
import { useNotificationStore } from '../src/stores/notification-store'
import type { Notification, WSMessage } from '../src/types'

function notif(overrides: Partial<Notification> = {}): Notification {
  return { id: 'n1', type: 'trade', title: 'Trade executed', message: 'SOL -> USDC', read: false, createdAt: '2026-01-01T00:00:00.000Z', ...overrides }
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ items: [], unread: 0, total: 0, isLoading: false, error: null })
  })

  it('adds a notification, dedupes by id, and increments unread for unread items', () => {
    const { add } = useNotificationStore.getState()
    add(notif({ id: 'a', read: false }))
    add(notif({ id: 'b', read: true }))
    add(notif({ id: 'a', read: false }))

    const { items, unread } = useNotificationStore.getState()
    assert.equal(items.length, 2)
    assert.equal(items[0].id, 'b')
    assert.equal(unread, 1)
  })

  it('maps a WS notification message and increments unread for unread items', () => {
    const msg: WSMessage = { type: 'notification', data: notif({ id: 'w1', read: false }) } as unknown as WSMessage
    useNotificationStore.getState().pushFromMessage(msg)

    const { items, unread } = useNotificationStore.getState()
    assert.equal(items.length, 1)
    assert.equal(items[0].id, 'w1')
    assert.equal(items[0].title, 'Trade executed')
    assert.equal(unread, 1)
  })

  it('ignores WS messages that are not notifications', () => {
    const msg: WSMessage = { type: 'TRADE_EXECUTED', tradeId: 't1' }
    useNotificationStore.getState().pushFromMessage(msg)

    const { items, unread } = useNotificationStore.getState()
    assert.equal(items.length, 0)
    assert.equal(unread, 0)
  })

  it('ignores malformed notification data', () => {
    const msg: WSMessage = { type: 'notification', data: { id: 'x' } } as unknown as WSMessage
    useNotificationStore.getState().pushFromMessage(msg)

    assert.equal(useNotificationStore.getState().items.length, 0)
  })

  it('marks all notifications as read and zeroes the unread count', async () => {
    const { add } = useNotificationStore.getState()
    add(notif({ id: 'a', read: false }))
    add(notif({ id: 'b', read: false }))
    assert.equal(useNotificationStore.getState().unread, 2)

    await useNotificationStore.getState().markAllRead(async () => {})

    const { items, unread } = useNotificationStore.getState()
    assert.equal(unread, 0)
    assert.ok(items.every((n) => n.read))
  })

  it('fetch populates items, total, and unread from an injected fetcher', async () => {
    const fake = async () => ({ items: [notif({ id: 'f1', read: false })], total: 10, unread: 3 })
    await useNotificationStore.getState().fetch(false, fake)

    const { items, total, unread, isLoading } = useNotificationStore.getState()
    assert.equal(items.length, 1)
    assert.equal(total, 10)
    assert.equal(unread, 3)
    assert.equal(isLoading, false)
  })

  it('reports loading while a notification fetch is pending', async () => {
    let resolveFetch!: (value: { items: Notification[]; total: number; unread: number }) => void
    const fetcher = () => new Promise<{ items: Notification[]; total: number; unread: number }>((resolve) => {
      resolveFetch = resolve
    })

    const request = useNotificationStore.getState().fetch(true, fetcher)
    assert.equal(useNotificationStore.getState().isLoading, true)

    resolveFetch({ items: [], total: 0, unread: 0 })
    await request
    assert.equal(useNotificationStore.getState().isLoading, false)
  })

  it('fetch sets error on failure', async () => {
    const fake = async () => {
      throw new Error('boom')
    }
    await useNotificationStore.getState().fetch(false, fake)

    const { error, isLoading } = useNotificationStore.getState()
    assert.equal(error, 'boom')
    assert.equal(isLoading, false)
  })
})
