'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { cn } from '@/lib/utils'

export interface ResponsiveDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
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
  *   taking at least 60% viewport height (`min-h-[60vh]`), with handle pill, no X close button, and z-[200] above mobile nav.
  */
export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  className,
  drawerClassName,
  minHeight = 'min-h-[60vh]',
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
        <DialogContent className={cn('max-w-md bg-bg-surface/95 backdrop-blur-2xl border-border-medium shadow-2xl rounded-2xl', className)}>
          {title && (
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-text-primary">{title}</DialogTitle>
              {description && <p className="text-xs text-text-tertiary mt-1">{description}</p>}
            </DialogHeader>
          )}
          {children}
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
            {/* Backdrop Overlay (z-[199] above mobile nav z-50) */}
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
              className="fixed inset-0 z-[199] bg-black/80 backdrop-blur-xl"
            />

            {/* Bottom Sheet Drawer (z-[200] fixed to viewport bottom, min 60% height) */}
            <m.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-[200] min-h-[60vh] max-h-[88vh] rounded-t-[32px] border-t border-white/15 bg-bg-surface/95 backdrop-blur-3xl p-5 shadow-[0_-16px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden',
                minHeight,
                drawerClassName
              )}
            >
              {/* Top Drag Handle Pill */}
              <div className="w-10 h-1.25 rounded-full bg-border-medium/80 mx-auto mb-3 shrink-0" />

              {/* Optional Header (No X button) */}
              {title && (
                <div className="pb-3 border-b border-border-subtle/80 shrink-0">
                  <h3 className="text-base font-bold tracking-tight text-text-primary">{title}</h3>
                  {description && <p className="text-xs text-text-tertiary mt-0.5">{description}</p>}
                </div>
              )}

              {/* Drawer Scrollable Body Content */}
              <div className="flex-1 flex flex-col overflow-y-auto py-3 space-y-4">
                {children}
              </div>
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
