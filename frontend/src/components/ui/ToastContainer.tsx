import { useEffect } from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type ToastItem } from '@/stores/toast-store'
import { SolscanLink } from './SolscanLink'
import { cn } from '@/lib/utils'

function ToastSingle({ toast }: { toast: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast)

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return
    const timer = setTimeout(() => {
      removeToast(toast.id)
    }, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, removeToast])

  const icons = {
    error: <AlertCircle className="size-5 shrink-0 text-status-error" />,
    success: <CheckCircle2 className="size-5 shrink-0 text-status-success" />,
    warning: <AlertTriangle className="size-5 shrink-0 text-status-warning" />,
    info: <Info className="size-5 shrink-0 text-primary-gold" />,
  }

  const borderStyles = {
    error: 'border-status-error/40 bg-bg-surface/95 shadow-red-950/20',
    success: 'border-status-success/40 bg-bg-surface/95 shadow-emerald-950/20',
    warning: 'border-status-warning/40 bg-bg-surface/95 shadow-amber-950/20',
    info: 'border-primary-gold/40 bg-bg-surface/95 shadow-yellow-950/20',
  }

  return (
    <div
      className={cn(
        'group relative flex w-80 max-w-sm flex-col gap-2 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300',
        borderStyles[toast.type],
      )}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {icons[toast.type]}
          <div>
            <h4 className="font-mono text-sm font-semibold text-text-primary">
              {toast.title}
            </h4>
            {toast.message && (
              <p className="mt-0.5 text-xs text-text-secondary leading-relaxed">
                {toast.message}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => removeToast(toast.id)}
          className="rounded p-1 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
          aria-label="Dismiss toast"
        >
          <X className="size-4" />
        </button>
      </div>

      {toast.txSignature && (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border-subtle/50 pt-2 text-xs">
          <span className="text-text-muted">Transaction:</span>
          <SolscanLink signature={toast.txSignature} type="tx" label="View on Solscan" />
        </div>
      )}
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 focus:outline-none"
    >
      {toasts.map((toast) => (
        <ToastSingle key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
