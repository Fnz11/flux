import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useTransactionStore } from '../src/stores/transaction-store'
import { useToastStore } from '../src/stores/toast-store'

describe('useTransactionStore', () => {
  beforeEach(() => {
    useTransactionStore.setState({ pending: [], history: [] })
    useToastStore.setState({ toasts: [] })
  })

  it('adds transaction to pending array', () => {
    const txId = useTransactionStore.getState().addTransaction({
      type: 'deposit',
      signature: null,
      vaultId: 'v1',
      inputToken: 'SOL',
      amountIn: 5,
      errorMessage: null,
    })

    const { pending } = useTransactionStore.getState()
    assert.equal(pending.length, 1)
    assert.equal(pending[0].id, txId)
    assert.equal(pending[0].status, 'pending')
    assert.equal(pending[0].amountIn, 5)
  })

  it('updates status and triggers error toast on transaction failure', () => {
    const txId = useTransactionStore.getState().addTransaction({
      type: 'trade',
      signature: 'mock_sig_123',
      vaultId: 'v1',
      errorMessage: null,
    })

    useTransactionStore.getState().updateStatus(txId, 'failed', 'Slippage exceeded')

    const { pending } = useTransactionStore.getState()
    assert.equal(pending[0].status, 'failed')
    assert.equal(pending[0].errorMessage, 'Slippage exceeded')

    const { toasts } = useToastStore.getState()
    assert.equal(toasts.length, 1)
    assert.equal(toasts[0].type, 'error')
    assert.equal(toasts[0].title, 'Transaction Failed')
    assert.equal(toasts[0].message, 'Slippage exceeded')
    assert.equal(toasts[0].txSignature, 'mock_sig_123')
  })

  it('confirms transaction and moves to history', () => {
    const txId = useTransactionStore.getState().addTransaction({
      type: 'withdraw',
      signature: null,
      vaultId: 'v2',
      errorMessage: null,
    })

    useTransactionStore.getState().confirmTransaction(txId, 'confirmed_sig_456')
    assert.equal(useTransactionStore.getState().pending[0].status, 'success')
    assert.equal(useTransactionStore.getState().pending[0].signature, 'confirmed_sig_456')

    useTransactionStore.getState().moveToHistory(txId)
    const { pending, history } = useTransactionStore.getState()
    assert.equal(pending.length, 0)
    assert.equal(history.length, 1)
    assert.equal(history[0].id, txId)
    assert.equal(history[0].signature, 'confirmed_sig_456')
  })

  it('clears all pending transactions', () => {
    useTransactionStore.getState().addTransaction({ type: 'trade', vaultId: 'v1', signature: null, errorMessage: null })
    useTransactionStore.getState().addTransaction({ type: 'deposit', vaultId: 'v2', signature: null, errorMessage: null })
    assert.equal(useTransactionStore.getState().pending.length, 2)

    useTransactionStore.getState().clearPending()
    assert.equal(useTransactionStore.getState().pending.length, 0)
  })
})
