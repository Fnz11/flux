import toast from 'react-hot-toast'
import type { ReactElement } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'

function notify(message: string, icon: ReactElement) {
  return toast(message, { icon })
}

export const toastSuccess = (message: string) =>
  notify(message, <CheckCircle2 className="shrink-0 text-status-success" size={18} />)

export const toastError = (message: string) =>
  notify(message, <XCircle className="shrink-0 text-status-error" size={18} />)

export const toastWarning = (message: string) =>
  notify(message, <AlertTriangle className="shrink-0 text-status-warning" size={18} />)

export const toastInfo = (message: string) =>
  notify(message, <Info className="shrink-0 text-primary-gold" size={18} />)