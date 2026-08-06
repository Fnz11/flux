import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useToastStore } from '../src/stores/toast-store'

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('adds and removes toasts correctly', () => {
    const id = useToastStore.getState().addToast({
      type: 'info',
      title: 'Welcome',
      message: 'Platform initialized',
    })

    assert.equal(useToastStore.getState().toasts.length, 1)
    assert.equal(useToastStore.getState().toasts[0].id, id)

    useToastStore.getState().removeToast(id)
    assert.equal(useToastStore.getState().toasts.length, 0)
  })

  it('adds txFailed toast with Solscan signature helper link capability', () => {
    const id = useToastStore.getState().txFailed('Blockhash expired', '5K9...sig')

    const toast = useToastStore.getState().toasts.find((t) => t.id === id)
    assert.ok(toast)
    assert.equal(toast?.type, 'error')
    assert.equal(toast?.title, 'Transaction Failed')
    assert.equal(toast?.message, 'Blockhash expired')
    assert.equal(toast?.txSignature, '5K9...sig')
  })

  it('adds txSuccess toast with signature', () => {
    const id = useToastStore.getState().txSuccess('Deposit confirmed', '3X8...sig')

    const toast = useToastStore.getState().toasts.find((t) => t.id === id)
    assert.ok(toast)
    assert.equal(toast?.type, 'success')
    assert.equal(toast?.title, 'Transaction Confirmed')
    assert.equal(toast?.message, 'Deposit confirmed')
    assert.equal(toast?.txSignature, '3X8...sig')
  })

  it('clears all toasts', () => {
    useToastStore.getState().addToast({ type: 'info', title: 'T1' })
    useToastStore.getState().addToast({ type: 'warning', title: 'T2' })
    assert.equal(useToastStore.getState().toasts.length, 2)

    useToastStore.getState().clearToasts()
    assert.equal(useToastStore.getState().toasts.length, 0)
  })
})
