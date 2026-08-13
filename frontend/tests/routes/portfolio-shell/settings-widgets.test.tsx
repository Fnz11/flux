import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RpcConfig } from '@/routes/settings/_components/RpcConfig'
import { TradePreferences } from '@/routes/settings/_components/TradePreferences'
import { WalletStatus } from '@/routes/settings/_components/WalletStatus'

const mocks = vi.hoisted(() => ({
  config: null as null | { dustThreshold: number },
  updateConfig: vi.fn(),
  wallet: {
    publicKey: null as null | { toBase58: () => string },
    wallet: null as null | { adapter: { name: string } },
  },
}))

vi.mock('@/stores/config-store', () => ({
  useConfigStore: <T,>(selector: (state: { config: typeof mocks.config; updateConfig: typeof mocks.updateConfig }) => T) =>
    selector({ config: mocks.config, updateConfig: mocks.updateConfig }),
}))
vi.mock('@solana/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }))
vi.mock('@/components/ui/AddressPill', () => ({ AddressPill: ({ address }: { address: string }) => <span>{address}</span> }))

describe('settings widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.config = null
    mocks.wallet = { publicKey: null, wallet: null }
  })

  it('defaults RPC selection to devnet and switches endpoints', () => {
    render(<RpcConfig />)
    const devnet = screen.getByRole('button', { name: /Solana Devnet/ })
    const localhost = screen.getByRole('button', { name: /Localhost/ })
    expect(devnet).toHaveClass('border-primary-coral')
    fireEvent.click(localhost)
    expect(localhost).toHaveClass('border-primary-coral')
    expect(devnet).not.toHaveClass('border-primary-coral')
  })

  it('loads persisted dust threshold into preferences', () => {
    mocks.config = { dustThreshold: 0.025 }
    render(<TradePreferences />)
    expect(screen.getByLabelText('Dust Asset Threshold (SOL)')).toHaveValue(0.025)
    expect(screen.getByLabelText('Max Slippage Tolerance (BPS)')).toHaveValue(50)
  })

  it('selects a slippage preset', () => {
    render(<TradePreferences />)
    fireEvent.click(screen.getByRole('button', { name: '1.0%' }))
    expect(screen.getByLabelText('Max Slippage Tolerance (BPS)')).toHaveValue(100)
  })

  it('validates slippage boundaries and negative dust', async () => {
    render(<TradePreferences />)
    fireEvent.change(screen.getByLabelText('Max Slippage Tolerance (BPS)'), { target: { value: '10001' } })
    fireEvent.change(screen.getByLabelText('Dust Asset Threshold (SOL)'), { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }))
    expect(await screen.findByText('Slippage must be between 1 and 10000 BPS')).toBeInTheDocument()
    expect(screen.getByText('Dust threshold must be a valid non-negative number')).toBeInTheDocument()
    expect(mocks.updateConfig).not.toHaveBeenCalled()
  })

  it('persists valid dust threshold and clears saved feedback', async () => {
    vi.useFakeTimers()
    render(<TradePreferences />)
    fireEvent.change(screen.getByLabelText('Dust Asset Threshold (SOL)'), { target: { value: '0.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }))
    await act(async () => { await Promise.resolve() })
    expect(mocks.updateConfig).toHaveBeenCalledWith({ dustThreshold: 0.5 })
    expect(screen.getByText('Settings saved!')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByText('Settings saved!')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('renders disconnected wallet guidance', () => {
    render(<WalletStatus />)
    expect(screen.getByText(/No wallet connected/)).toBeInTheDocument()
  })

  it('renders connected address and adapter name', () => {
    mocks.wallet = { publicKey: { toBase58: () => 'WalletAddress123' }, wallet: { adapter: { name: 'Phantom' } } }
    render(<WalletStatus />)
    expect(screen.getByText('WalletAddress123')).toBeInTheDocument()
    expect(screen.getByText('Connected (Phantom)')).toBeInTheDocument()
  })
})
