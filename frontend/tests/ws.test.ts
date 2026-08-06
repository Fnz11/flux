import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { useWebSocketStore } from '../src/stores/websocket-store'
import { subscribeToNotifications } from '../src/services/ws'

const MAX_RECONNECT = 10
const OPEN = 1
const CLOSED = 3

interface FakeLike {
  url: string
  readyState: number
  sent: string[]
  onopen: (() => void) | null
  onclose: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: (() => void) | null
  send: (data: string) => void
  close: () => void
}

class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = OPEN
  static CLOSING = 2
  static CLOSED = CLOSED
  static instances: FakeLike[] = []

  url: string
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = CLOSED
    this.onclose?.()
  }
}

function openSocket(socket: FakeLike) {
  socket.readyState = OPEN
  socket.onopen?.()
}

function receive(socket: FakeLike, data: unknown) {
  socket.onmessage?.({ data })
}

let originalWebSocket: typeof WebSocket | undefined

describe('websocket notifications client', () => {
  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket
    FakeWebSocket.instances = []
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
    useWebSocketStore.getState().disconnect()
    useWebSocketStore.setState({
      isConnected: false,
      lastMessage: null,
      reconnectAttempts: 0,
      subscriptions: [],
      ws: null,
      handlers: new Set(),
    })
  })

  afterEach(() => {
    if (originalWebSocket !== undefined) {
      globalThis.WebSocket = originalWebSocket
    }
  })

  it('subscribeToNotifications subscribes while mounted and unsubscribes on cleanup', () => {
    const cleanup = subscribeToNotifications('0xWallet')
    assert.deepEqual(useWebSocketStore.getState().subscriptions, ['user:0xWallet'])
    cleanup()
    assert.deepEqual(useWebSocketStore.getState().subscriptions, [])
  })

  it('subscribeToNotifications with empty wallet still guards through the store (no op helper)', () => {
    const cleanup = subscribeToNotifications('')
    assert.deepEqual(useWebSocketStore.getState().subscriptions, ['user:'])
    cleanup()
  })

  it('open socket sends {type:subscribe} for the subscribed channel', () => {
    subscribeToNotifications('0xWallet')
    useWebSocketStore.getState().connect('ws://x/user:0xWallet')
    const socket = FakeWebSocket.instances[0]
    openSocket(socket)
    assert.equal(socket.sent[0], '{"type":"subscribe","channel":"user:0xWallet"}')
  })

  it('re-subscribes on reconnect and replays the subscribe command', () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    try {
      useWebSocketStore.getState().connect('ws://x/ws')
      const first = FakeWebSocket.instances[0]
      openSocket(first)
      useWebSocketStore.getState().subscribe('user:0xWallet')
      first.close()
      assert.equal(first.sent.filter((m) => m.includes('subscribe')).length, 1)

      mock.timers.tick(65_000)
      const second = FakeWebSocket.instances[1]
      assert.ok(second, 'reconnect constructed a new socket')
      openSocket(second)
      assert.equal(
        second.sent.filter((m) => m.includes('"type":"subscribe"')).length,
        1,
        'reconnect replays subscribe',
      )
      assert.equal(second.sent[0], '{"type":"subscribe","channel":"user:0xWallet"}')
    } finally {
      mock.timers.reset()
    }
  })

  it('drives onmessage for the subscribed channel to the store handlers', () => {
    let received: unknown = null
    const off = useWebSocketStore.getState().onMessage((msg) => {
      received = msg
    })

    useWebSocketStore.getState().connect('ws://x/ws')
    const socket = FakeWebSocket.instances[0]
    openSocket(socket)
    receive(socket, JSON.stringify({ type: 'notification', data: { id: 'n1' }, timestamp: 1 }))
    assert.deepEqual(received, { type: 'notification', data: { id: 'n1' }, timestamp: 1 })
    off()
  })

  it('subscribes to the right channel but no other channel (wrong channel not subscribed)', () => {
    subscribeToNotifications('0xWallet')
    useWebSocketStore.getState().connect('ws://x/ws')
    const socket = FakeWebSocket.instances[0]
    openSocket(socket)
    const subs = useWebSocketStore.getState().subscriptions
    assert.ok(subs.includes('user:0xWallet'))
    assert.equal(subs.includes('user:other'), false)
    assert.equal(subs.filter((c) => c.includes('other')).length, 0)
  })

  it('reconnects with backoff up to MAX_RECONNECT while subscriptions remain', () => {
    mock.timers.enable({ apis: ['setTimeout'] })
    try {
      useWebSocketStore.getState().connect('ws://x/ws')
      const first = FakeWebSocket.instances[0]
      openSocket(first)
      useWebSocketStore.getState().subscribe('user:0xWallet')

      first.close()

      for (let attempt = 1; attempt < MAX_RECONNECT; attempt++) {
        const delay = 1000 * Math.pow(2, attempt - 1)
        mock.timers.tick(delay + 1000)
        const socket = FakeWebSocket.instances[attempt]
        assert.ok(socket, `reconnect attempt ${attempt} constructed a socket`)
        socket.close()
      }

      const attempts = FakeWebSocket.instances.length
      assert.equal(attempts, MAX_RECONNECT)
      assert.equal(
        useWebSocketStore.getState().reconnectAttempts,
        MAX_RECONNECT,
        'attempts counter stops at the cap',
      )

      mock.timers.tick(100_000)
      assert.equal(FakeWebSocket.instances.length, MAX_RECONNECT, 'no further reconnect after cap')
    } finally {
      mock.timers.reset()
    }
  })

  it('does not reconnect when no subscriptions exist', () => {
    useWebSocketStore.getState().connect('ws://x/ws')
    const first = FakeWebSocket.instances[0]
    openSocket(first)
    mock.timers.enable({ apis: ['setTimeout'] })
    try {
      first.close()
      mock.timers.tick(100_000)
      assert.equal(FakeWebSocket.instances.length, 1)
    } finally {
      mock.timers.reset()
    }
  })
})