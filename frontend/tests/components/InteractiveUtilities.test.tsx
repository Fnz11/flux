import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { NotFoundPage } from '@/components/ui/NotFoundPage'
import { SweepButton } from '@/components/ui/SweepButton'
import { VirtualizedList } from '@/components/ui/VirtualizedList'
import { ResponsiveDrawer } from '@/components/ui/ResponsiveDrawer'

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => routerMocks.navigate,
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div data-testid="desktop-dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
}))
vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  domAnimation: {},
  m: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

function Broken(): never {
  throw new Error('render exploded')
}

describe('ErrorBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => { consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => consoleError.mockRestore())

  it('renders children while healthy', () => {
    render(<ErrorBoundary><span>Healthy child</span></ErrorBoundary>)
    expect(screen.getByText('Healthy child')).toBeInTheDocument()
  })

  it('catches render errors and resets through a functional fallback', () => {
    const onReset = vi.fn()
    render(<ErrorBoundary onReset={onReset} fallback={(error, reset) => <button onClick={reset}>{error.message}</button>}><Broken /></ErrorBoundary>)
    fireEvent.click(screen.getByRole('button', { name: 'render exploded' }))
    expect(onReset).toHaveBeenCalledOnce()
  })
})

describe('NotFoundPage', () => {
  beforeEach(() => routerMocks.navigate.mockReset())

  it('renders 404 guidance and destination links', () => {
    render(<NotFoundPage />)
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/portfolio')
    expect(screen.getByRole('link', { name: /return home/i })).toHaveAttribute('href', '/')
  })

  it('navigates back through the router boundary', () => {
    render(<NotFoundPage />)
    fireEvent.click(screen.getByRole('button', { name: /go back/i }))
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '..' })
  })
})

describe('SweepButton', () => {
  it('forwards click, type, and custom icon', () => {
    const onClick = vi.fn()
    render(<SweepButton type="submit" icon={<span>Rocket</span>} onClick={onClick}>Launch</SweepButton>)
    const button = screen.getByRole('button', { name: /rocket launch/i })
    expect(button).toHaveAttribute('type', 'submit')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('prevents clicks while disabled', () => {
    const onClick = vi.fn()
    render(<SweepButton disabled onClick={onClick}>Launch</SweepButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('VirtualizedList', () => {
  const renderList = (items: string[]) => render(
    <VirtualizedList items={items} pageSize={2} virtualizeThreshold={3} keyExtractor={(item) => item} renderItem={(item, index) => <span>{index}:{item}</span>} emptyState={<p>No rows</p>} />,
  )

  it('renders its empty state', () => {
    renderList([])
    expect(screen.getByText('No rows')).toBeInTheDocument()
  })

  it('paginates items with absolute indexes', () => {
    renderList(['A', 'B', 'C'])
    expect(screen.getByText('0:A')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('2:C')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('announces virtualization metadata at the threshold', () => {
    renderList(['A', 'B', 'C'])
    expect(screen.getByText('Virtualized list enabled (3 items)')).toBeInTheDocument()
    expect(screen.getByText('Showing 1 - 2 of 3')).toBeInTheDocument()
  })
})

describe('ResponsiveDrawer', () => {
  function setWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  }

  it('renders a desktop dialog', () => {
    setWidth(1024)
    render(<ResponsiveDrawer open onOpenChange={vi.fn()} title="Details" description="Desktop content"><p>Body</p></ResponsiveDrawer>)
    expect(screen.getByTestId('desktop-dialog')).toBeInTheDocument()
    expect(screen.getByText('Desktop content')).toBeInTheDocument()
  })

  it('renders a mobile portal and locks body scrolling', () => {
    setWidth(375)
    const view = render(<ResponsiveDrawer open onOpenChange={vi.fn()} title="Mobile details"><p>Mobile body</p></ResponsiveDrawer>)
    expect(screen.getByText('Mobile body')).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('closes mobile drawer from backdrop', () => {
    setWidth(375)
    const onOpenChange = vi.fn()
    const { container } = render(<ResponsiveDrawer open onOpenChange={onOpenChange}><p>Mobile body</p></ResponsiveDrawer>)
    const backdrop = document.body.querySelector('.z-\\[199\\]') as HTMLElement
    expect(backdrop).not.toBeNull()
    fireEvent.click(backdrop)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(container).toBeEmptyDOMElement()
  })
})
