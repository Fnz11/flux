import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/card'
import { Input } from '../../src/components/ui/input'
import { Label } from '../../src/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../src/components/ui/table'
import { ToggleGroup } from '../../src/components/ui/toggle-group'
import { Tooltip } from '../../src/components/ui/tooltip'
import { renderWithProviders } from '../helpers'

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('Table', () => {
  function renderTable() {
    return render(
      <Table aria-label="Vault positions">
        <TableHeader>
          <TableRow><TableHead scope="col">Asset</TableHead><TableHead scope="col">Value</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell>SOL</TableCell><TableCell>$200</TableCell></TableRow>
        </TableBody>
      </Table>,
    )
  }

  it('preserves the table accessible name and semantics', () => {
    renderTable()

    expect(screen.getByRole('table', { name: 'Vault positions' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('exposes column headers', () => {
    renderTable()

    expect(screen.getByRole('columnheader', { name: 'Asset' })).toHaveAttribute('scope', 'col')
    expect(screen.getByRole('columnheader', { name: 'Value' })).toHaveAttribute('scope', 'col')
  })

  it('exposes body cells and their content', () => {
    renderTable()

    expect(screen.getByRole('cell', { name: 'SOL' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '$200' })).toBeInTheDocument()
  })
})

describe('ToggleGroup', () => {
  const options = [
    { label: 'Daily', value: 'day' },
    { label: 'Weekly', value: 'week' },
  ]

  it('renders each option as a non-submitting button', () => {
    render(<ToggleGroup options={options} value="day" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Daily' })).toHaveAttribute('type', 'button')
    expect(screen.getByRole('button', { name: 'Weekly' })).toHaveAttribute('type', 'button')
  })

  it('reports the selected option value', () => {
    const onChange = vi.fn()
    render(<ToggleGroup options={options} value="day" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }))

    expect(onChange).toHaveBeenCalledWith('week')
  })
})

describe('Tooltip', () => {
  it('shows accessible content when its trigger receives focus', async () => {
    renderWithProviders(
      <Tooltip content="Copies the address"><button>Copy</button></Tooltip>,
    )

    fireEvent.focus(screen.getByRole('button', { name: 'Copy' }))

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Copies the address')
  })

  it('hides content after the trigger loses focus', async () => {
    renderWithProviders(
      <Tooltip content="More information"><button>Info</button></Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: 'Info' })
    fireEvent.focus(trigger)
    await screen.findByRole('tooltip')

    fireEvent.blur(trigger)

    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())
  })
})

describe('Card and Label', () => {
  it('composes card content without changing supplied semantics', () => {
    render(
      <Card as="article" aria-label="Portfolio summary">
        <CardHeader><CardTitle role="heading" aria-level={2}>Portfolio</CardTitle></CardHeader>
        <CardContent>Balance: $500</CardContent>
      </Card>,
    )

    expect(screen.getByLabelText('Portfolio summary')).toHaveTextContent('Balance: $500')
    expect(screen.getByRole('heading', { name: 'Portfolio', level: 2 })).toBeInTheDocument()
  })

  it('associates a label with an input', () => {
    render(<><Label htmlFor="name">Vault name</Label><Input id="name" /></>)

    expect(screen.getByLabelText('Vault name')).toHaveAttribute('id', 'name')
  })

  it('forwards a label ref', () => {
    const ref = { current: null as HTMLLabelElement | null }
    render(<Label ref={ref}>Strategy</Label>)

    expect(ref.current).toBe(screen.getByText('Strategy'))
  })
})
