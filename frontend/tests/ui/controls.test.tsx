import * as React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../../src/components/ui/button'
import { Checkbox } from '../../src/components/ui/checkbox'
import { Input } from '../../src/components/ui/input'
import { Textarea } from '../../src/components/ui/textarea'

describe('Button', () => {
  it.each(['default', 'outline', 'ghost', 'destructive', 'sweep'] as const)(
    'renders the %s variant as an operable button',
    (variant) => {
      const onClick = vi.fn()
      render(<Button variant={variant} onClick={onClick}>{variant}</Button>)

      fireEvent.click(screen.getByRole('button', { name: variant }))

      expect(onClick).toHaveBeenCalledOnce()
    },
  )

  it('forwards an explicit submit type', () => {
    render(<Button type="submit">Save</Button>)

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit')
  })

  it('supports non-submitting sweep actions by default', () => {
    render(<Button variant="sweep">Preview</Button>)

    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('type', 'button')
  })

  it('prevents disabled actions', () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Delete</Button>)

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onClick).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('can expose a composed loading state', () => {
    render(<Button disabled aria-busy="true">Saving...</Button>)

    const button = screen.getByRole('button', { name: 'Saving...' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })
})

describe('Input and Textarea', () => {
  it('forwards an input ref and preserves its type', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<Input ref={ref} type="email" aria-label="Email" />)

    expect(ref.current).toBe(screen.getByRole('textbox', { name: 'Email' }))
    expect(ref.current).toHaveAttribute('type', 'email')
  })

  it('accepts input and reports invalid state', () => {
    render(<Input aria-label="Amount" aria-invalid="true" />)
    const input = screen.getByRole('textbox', { name: 'Amount' })

    fireEvent.change(input, { target: { value: '42' } })

    expect(input).toHaveValue('42')
    expect(input).toBeInvalid()
  })

  it('exposes disabled input behavior', () => {
    const onChange = vi.fn()
    render(<Input disabled defaultValue="fixed" aria-label="Locked input" onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Locked input' })

    input.click()

    expect(input).toBeDisabled()
    expect(input).toHaveValue('fixed')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('forwards a textarea ref and accepts multiline input', () => {
    const ref = React.createRef<HTMLTextAreaElement>()
    render(<Textarea ref={ref} aria-label="Notes" />)
    const textarea = screen.getByRole('textbox', { name: 'Notes' })

    fireEvent.change(textarea, { target: { value: 'first\nsecond' } })

    expect(ref.current).toBe(textarea)
    expect(textarea).toHaveValue('first\nsecond')
  })

  it('exposes disabled and invalid textarea states', () => {
    render(<Textarea disabled aria-invalid="true" aria-label="Invalid notes" />)

    const textarea = screen.getByRole('textbox', { name: 'Invalid notes' })
    expect(textarea).toBeDisabled()
    expect(textarea).toBeInvalid()
  })
})

describe('Checkbox', () => {
  it('reports a checked toggle', () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox aria-label="Accept terms" onCheckedChange={onCheckedChange} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Accept terms' }))

    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('reports an unchecked toggle', () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox checked aria-label="Subscribe" onCheckedChange={onCheckedChange} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Subscribe' }))

    expect(onCheckedChange).toHaveBeenCalledWith(false)
  })

  it('does not toggle when disabled', () => {
    const onCheckedChange = vi.fn()
    render(<Checkbox disabled aria-label="Unavailable" onCheckedChange={onCheckedChange} />)

    screen.getByRole('checkbox', { name: 'Unavailable' }).click()

    expect(screen.getByRole('checkbox', { name: 'Unavailable' })).toBeDisabled()
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
