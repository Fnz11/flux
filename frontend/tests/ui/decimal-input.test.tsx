import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { useState } from 'react'

describe('DecimalInput', () => {
  it('renders with placeholder and value', () => {
    render(<DecimalInput placeholder="0.00" value="12.34" onChange={() => {}} />)
    const input = screen.getByPlaceholderText('0.00')
    expect(input).toHaveValue('12.34')
  })

  it('filters out non-numeric characters', () => {
    const handleChange = vi.fn()
    render(<DecimalInput placeholder="0.00" onChange={handleChange} />)
    const input = screen.getByPlaceholderText('0.00')

    fireEvent.change(input, { target: { value: 'abc' } })
    expect(input).toHaveValue('')
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('replaces comma with dot for international format', () => {
    const handleChange = vi.fn()
    const handleValueChange = vi.fn()
    render(<DecimalInput placeholder="0.00" onChange={handleChange} onValueChange={handleValueChange} />)
    const input = screen.getByPlaceholderText('0.00')

    fireEvent.change(input, { target: { value: '12,5' } })
    expect(input).toHaveValue('12.5')
    expect(handleValueChange).toHaveBeenCalledWith('12.5', 12.5)
  })

  it('limits decimal places according to maxDecimals', () => {
    const handleValueChange = vi.fn()
    render(<DecimalInput placeholder="0.00" maxDecimals={2} onValueChange={handleValueChange} />)
    const input = screen.getByPlaceholderText('0.00')

    fireEvent.change(input, { target: { value: '1.23' } })
    expect(input).toHaveValue('1.23')

    // 3 decimals should be rejected
    fireEvent.change(input, { target: { value: '1.234' } })
    expect(input).toHaveValue('1.23')
  })

  it('cleans trailing dot on blur', () => {
    const handleValueChange = vi.fn()
    render(<DecimalInput placeholder="0.00" onValueChange={handleValueChange} />)
    const input = screen.getByPlaceholderText('0.00')

    fireEvent.change(input, { target: { value: '12.' } })
    expect(input).toHaveValue('12.')

    fireEvent.blur(input)
    expect(input).toHaveValue('12')
    expect(handleValueChange).toHaveBeenLastCalledWith('12', 12)
  })

  it('syncs correctly with state updates', () => {
    function ControlledTest() {
      const [val, setVal] = useState<number | string>(10)
      return (
        <div>
          <DecimalInput placeholder="0.00" value={val} onValueChange={(_, num) => setVal(num ?? 0)} />
          <button onClick={() => setVal(25.5)}>Set 25.5</button>
        </div>
      )
    }

    render(<ControlledTest />)
    const input = screen.getByPlaceholderText('0.00')
    expect(input).toHaveValue('10')

    fireEvent.click(screen.getByRole('button', { name: 'Set 25.5' }))
    expect(input).toHaveValue('25.5')
  })
})
