import { useEffect, useRef } from 'react'
import { Bell, Loader2, CheckCheck, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notification-store'

interface NotificationsPopoverProps {
  open: boolean
  onToggle: () => void
}

export function NotificationsPopover({ open, onToggle }: NotificationsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const items = useNotificationStore((s) => s.items)
  const unread = useNotificationStore((s) => s.unread)
  const isLoading = useNotificationStore((s) => s.isLoading)

  useEffect(() => {
    if (!open) return
    useNotificationStore.getState().fetch?.()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggle()
    }
    document.addEventListener('mousedown', handler)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      window.removeEventListener('keydown', esc)
    }
  }, [open, onToggle])

  const handleMarkAllRead = () => {
    useNotificationStore.getState().markAllRead?.()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="relative flex size-9 items-center justify-center rounded-xl border border-border-medium bg-bg-elevated/80 backdrop-blur-md text-text-secondary hover:text-text-primary hover:border-primary-coral/40 hover:bg-bg-inset transition-all shadow-md group cursor-pointer"
        title="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell className="size-4 text-text-secondary group-hover:text-primary-coral transition-colors" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-gradient-to-r from-primary-coral to-primary-amber text-[10px] font-bold leading-none text-black shadow-md">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 overflow-hidden rounded-2xl border border-border-medium bg-bg-elevated text-text-primary shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-border-subtle/60 px-4 py-3">
            <span className="text-xs font-bold text-text-primary">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary-coral hover:underline transition-all cursor-pointer"
              >
                <CheckCheck className="size-3.5" strokeWidth={1.75} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-5 text-xs text-text-muted">
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
                Loading notifications...
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-text-muted">
                <Inbox className="size-6 text-text-tertiary" strokeWidth={1.5} />
                <span className="text-xs font-semibold text-text-secondary">No notifications yet</span>
                <span className="text-[11px] text-text-tertiary">Updates about your vaults will appear here</span>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'border-b border-border-subtle/40 px-4 py-3 last:border-b-0 transition-colors',
                    n.read ? 'opacity-60' : 'bg-bg-inset/40 hover:bg-bg-inset/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-text-primary">{n.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-text-tertiary font-mono">{formatTime(n.createdAt)}</span>
                  </div>
                  {n.message && <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{n.message}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return d.toLocaleDateString()
}