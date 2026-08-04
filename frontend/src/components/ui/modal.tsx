import * as React from 'react'
import { Dialog, DialogContent, DialogTitle } from './dialog'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
}

function Modal({ open, onOpenChange, title, children }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export { Modal }
