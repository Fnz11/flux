import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AllocationSlider } from '@/components/ui/AllocationSlider'

describe('AllocationSlider', () => {
  it('renders with label and percentage', () => {
    render(<AllocationSlider value={45} onChange={vi.fn()} label="Allocation" />)
    expect(screen.getByText('Allocation')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('renders orange gradient style according to value', () => {
    render(<AllocationSlider value={39} onChange={vi.fn()} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveStyle({
      background: 'linear-gradient(to right, rgb(255, 107, 74) 0%, rgb(255, 107, 74) 39%, rgba(255, 255, 255, 0.1) 39%, rgba(255, 255, 255, 0.1) 100%)',
    })
  })

  it('immediately triggers onChange when a percentage preset button is clicked', () => {
    const onChange = vi.fn()
    render(<AllocationSlider value={0} onChange={onChange} />)
    
    const btn50 = screen.getByRole('button', { name: '50%' })
    fireEvent.click(btn50)
    expect(onChange).toHaveBeenCalledWith(50)

    const btnMax = screen.getByRole('button', { name: 'MAX' })
    fireEvent.click(btnMax)
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it('debounces slider drag changes', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<AllocationSlider value={10} onChange={onChange} debounceMs={100} />)

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '65' } })

    // Immediately updates display
    expect(screen.getByText('65%')).toBeInTheDocument()
    // Debouncer hasn't fired yet
    expect(onChange).not.toHaveBeenCalled()

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(onChange).toHaveBeenCalledWith(65)
    vi.useRealTimers()
  })
})
