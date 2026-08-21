'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from './dialog'
import { cn } from '@/lib/utils'

export interface ResponsiveDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  footer?: React.ReactNode
  children: React.ReactNode
  trigger?: React.ReactNode
  className?: string
  drawerClassName?: string
  showCloseButton?: boolean
  minHeight?: string
}

const emptySubscribe = () => () => {}

/**
  * Custom hook to detect mobile viewport (< 768px)
  */
export function useIsMobile(breakpoint = 768) {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      window.addEventListener('resize', callback)
      return () => window.removeEventListener('resize', callback)
    },
    []
  )

  const getSnapshot = React.useCallback(() => {
    return window.innerWidth < breakpoint
  }, [breakpoint])

  const getServerSnapshot = React.useCallback(() => false, [])

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
  * ResponsiveDrawer component:
  * - On Desktop (>= 768px): Renders as a standard centered Radix Dialog / Modal.
  * - On Mobile (< 768px): Renders via React Portal directly into document.body as a fixed bottom slide-up Drawer
  *   with handle pill, no X close button, and z-[200] above mobile nav.
  */
export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  trigger: _trigger,
  className,
  drawerClassName,
  minHeight = 'min-h-0',
}: ResponsiveDrawerProps) {
  const isMobile = useIsMobile()
  const mounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  // Prevent background body scroll when drawer is open on mobile
  React.useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, open])

  // Desktop View: Radix Dialog / Modal
  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className}>
          {title && (
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          <DialogBody>{children}</DialogBody>
          {footer && <DialogFooter>{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    )
  }

  // Mobile View Drawer Content
  const mobileDrawerContent = (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {open && (
          <div className="md:hidden">
            {/* Backdrop Overlay */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 z-[199] bg-black/50 backdrop-blur-sm"
            />

            {/* Bottom Sheet Drawer (auto-fit height, edge-to-edge) */}
            <m.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-[200] h-auto max-h-[88vh] rounded-t-[28px] border-t border-white/12 bg-bg-elevated/40 backdrop-blur-3xl shadow-[0_-16px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col overflow-hidden p-0',
                minHeight,
                drawerClassName
              )}
            >
              {/* Top Drag Handle */}
              <div className="pt-3 pb-1 shrink-0 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Edge-to-edge Header */}
              {title && (
                <div className="px-5 py-3 border-b border-white/10 shrink-0">
                  <h3 className="text-base font-bold tracking-tight text-text-primary">{title}</h3>
                  {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
                </div>
              )}

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {children}
              </div>

              {/* Edge-to-edge Footer */}
              {footer && (
                <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0 w-full bg-white/[0.02]">
                  {footer}
                </div>
              )}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )

  // Use React Portal to render mobile drawer directly into document.body
  if (mounted && typeof document !== 'undefined') {
    return createPortal(mobileDrawerContent, document.body)
  }

  return null
}
