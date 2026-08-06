import * as React from 'react'
import { ResponsiveDrawer } from './ResponsiveDrawer'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}

function Modal({ open, onOpenChange, title, description, children }: ModalProps) {
  return (
    <ResponsiveDrawer open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {children}
    </ResponsiveDrawer>
  )
}

export { Modal }
