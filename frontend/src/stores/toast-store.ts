import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  txSignature?: string
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
}

interface ToastActions {
  addToast: (toast: Omit<ToastItem, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
  txFailed: (message: string, signature?: string | null) => string
  txSuccess: (message: string, signature?: string | null) => string
}

type ToastStore = ToastState & ToastActions

let toastCounter = 0

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${++toastCounter}`
    const newToast: ToastItem = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    }
    set((s) => ({ toasts: [...s.toasts, newToast] }))
    return id
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearToasts: () => set({ toasts: [] }),

  txFailed: (message, signature) => {
    const id = `toast_${Date.now()}_${++toastCounter}`
    const newToast: ToastItem = {
      id,
      type: 'error',
      title: 'Transaction Failed',
      message,
      txSignature: signature || undefined,
      duration: 7000,
    }
    set((s) => ({ toasts: [...s.toasts, newToast] }))
    return id
  },

  txSuccess: (message, signature) => {
    const id = `toast_${Date.now()}_${++toastCounter}`
    const newToast: ToastItem = {
      id,
      type: 'success',
      title: 'Transaction Confirmed',
      message,
      txSignature: signature || undefined,
      duration: 5000,
    }
    set((s) => ({ toasts: [...s.toasts, newToast] }))
    return id
  },
}))
