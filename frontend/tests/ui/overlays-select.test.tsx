import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '../../src/components/ui/dialog'
import { Modal } from '../../src/components/ui/modal'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../src/components/ui/select'

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
})

afterAll(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture
  HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
  HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture
})

describe('Dialog and Modal', () => {
  it('opens a dialog from its trigger', () => {
    render(
      <Dialog>
        <DialogTrigger>Open settings</DialogTrigger>
        <DialogContent><DialogTitle>Settings</DialogTitle></DialogContent>
      </Dialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })

  it('closes a dialog through DialogClose', async () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Preferences</DialogTitle>
          <DialogClose>Cancel</DialogClose>
        </DialogContent>
      </Dialog>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('calls controlled dialog close on Escape', () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent><DialogTitle>Account</DialogTitle></DialogContent>
      </Dialog>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('renders modal title, description, and content when open', () => {
    render(
      <Modal open onOpenChange={vi.fn()} title="Confirm trade" description="Review execution">
        <button>Confirm</button>
      </Modal>,
    )

    expect(screen.getByRole('dialog', { name: 'Confirm trade' })).toBeInTheDocument()
    expect(screen.getByText('Review execution')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument()
  })

  it('does not render modal content when closed', () => {
    render(<Modal open={false} onOpenChange={vi.fn()} title="Hidden"><p>Secret</p></Modal>)

    expect(screen.queryByText('Secret')).not.toBeInTheDocument()
  })
})

describe('Select', () => {
  it('opens and selects an option', async () => {
    const onValueChange = vi.fn()
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Network"><SelectValue placeholder="Choose network" /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="mainnet">Mainnet</SelectItem>
            <SelectItem value="devnet">Devnet</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    )

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Network' }), { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Devnet' }))

    expect(onValueChange).toHaveBeenCalledWith('devnet')
  })

  it('shows its controlled value', () => {
    render(
      <Select value="mainnet">
        <SelectTrigger aria-label="Cluster"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="mainnet">Mainnet</SelectItem></SelectContent>
      </Select>,
    )

    expect(screen.getByRole('combobox', { name: 'Cluster' })).toHaveTextContent('Mainnet')
  })

  it('does not open when disabled', () => {
    render(
      <Select disabled>
        <SelectTrigger aria-label="Disabled network"><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent><SelectItem value="mainnet">Mainnet</SelectItem></SelectContent>
      </Select>,
    )

    const trigger = screen.getByRole('combobox', { name: 'Disabled network' })
    fireEvent.click(trigger)

    expect(trigger).toBeDisabled()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})
