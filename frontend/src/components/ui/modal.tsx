import * as React from 'react'
import { ResponsiveDrawer } from './ResponsiveDrawer'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}

function Modal({ open, onOpenChange, title, description, footer, children, className }: ModalProps) {
  return (
    <ResponsiveDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={footer}
      className={className}
    >
      {children}
    </ResponsiveDrawer>
  )
}

export { Modal }
