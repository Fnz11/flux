import { create } from 'zustand'
import type { Transaction, TransactionStatus } from '../types'
import { toastError } from '@/lib/toast'

interface TransactionState {
  pending: Transaction[]
  history: Transaction[]
}

interface TransactionActions {
  addTransaction: (tx: Omit<Transaction, 'id' | 'timestamp' | 'status'>) => string
  updateStatus: (id: string, status: TransactionStatus, errorMessage?: string) => void
  confirmTransaction: (id: string, signature: string) => void
  moveToHistory: (id: string) => void
  clearPending: () => void
}

type TransactionStore = TransactionState & TransactionActions

let txCounter = 0

export const useTransactionStore = create<TransactionStore>()((set) => ({
  pending: [],
  history: [],

  addTransaction: (tx) => {
    const id = `tx_${Date.now()}_${++txCounter}`
    const newTx: Transaction = {
      ...tx,
      id,
      status: 'pending',
      timestamp: Date.now(),
    }
    set((s) => ({ pending: [newTx, ...s.pending] }))
    return id
  },

  updateStatus: (id, status, errorMessage) =>
    set((s) => {
      const updated = s.pending.map((tx) =>
        tx.id === id ? { ...tx, status, errorMessage: errorMessage ?? null } : tx,
      )
      if (status === 'failed') {
        toastError(errorMessage || 'Transaction failed')
      }
      return { pending: updated }
    }),

  confirmTransaction: (id, signature) =>
    set((s) => ({
      pending: s.pending.map((tx) =>
        tx.id === id ? { ...tx, signature, status: 'success' } : tx,
      ),
    })),

  moveToHistory: (id) =>
    set((s) => {
      const tx = s.pending.find((t) => t.id === id)
      if (!tx) return s
      return {
        pending: s.pending.filter((t) => t.id !== id),
        history: [tx, ...s.history].slice(0, 100),
      }
    }),

  clearPending: () => set({ pending: [] }),
}))
