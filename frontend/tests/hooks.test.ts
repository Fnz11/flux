import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeposit } from '../src/hooks/useDeposit'
import { useExecuteTrade } from '../src/hooks/useExecuteTrade'
import { useWithdraw } from '../src/hooks/useWithdraw'

const mocks = vi.hoisted(() => ({
  addTransaction: vi.fn(() => 'tx-1'),
  updateStatus: vi.fn(),
  confirmTransaction: vi.fn(),
  moveToHistory: vi.fn(),
  getAccountInfo: vi.fn(async () => null),
  getLatestBlockhash: vi.fn(async () => ({ blockhash: 'blockhash' })),
  sendRawTransaction: vi.fn(async () => 'withdraw-signature'),
  confirmOnChain: vi.fn(async () => ({ value: { err: null } })),
  signTransaction: vi.fn(async (transaction: any) => transaction),
  getProgram: vi.fn(),
  sendTransaction: vi.fn(async () => 'chain-signature'),
  apiPost: vi.fn(async () => ({})),
  depositInstruction: vi.fn(async () => ({})),
  withdrawInstruction: vi.fn(async () => ({})),
  tradeInstruction: vi.fn(async () => ({})),
  walletConnected: true,
  anchorWalletConnected: true,
}))

const publicKey = {
  toBase58: () => 'MockWallet111111111111111111111111111111111',
  toBuffer: () => Buffer.from('wallet'),
  equals: (other: any) => other?.toBase58?.() === 'MockWallet111111111111111111111111111111111',
}

const connection = {
  getAccountInfo: mocks.getAccountInfo,
  getLatestBlockhash: mocks.getLatestBlockhash,
  sendRawTransaction: mocks.sendRawTransaction,
  confirmTransaction: mocks.confirmOnChain,
}

vi.mock('../src/stores', () => ({
  useTransactionStore: (selector: any) => selector(mocks),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useConnection: () => ({ connection }),
  useWallet: () => ({
    publicKey: mocks.walletConnected ? publicKey : null,
    signTransaction: mocks.walletConnected ? mocks.signTransaction : null,
    signAllTransactions: vi.fn(),
  }),
  useAnchorWallet: () =>
    mocks.anchorWalletConnected
      ? { publicKey, signTransaction: mocks.signTransaction, signAllTransactions: vi.fn() }
      : null,
}))

vi.mock('@solana/web3.js', () => {
  class PublicKey {
    constructor(private key: string) {}
    toBase58() { return this.key }
    toBuffer() { return Buffer.from(this.key) }
    equals(other: any) { return other?.toBase58?.() === this.key }
    static findProgramAddressSync() { return [new PublicKey('pda'), 255] }
  }
  class Transaction {
    feePayer: any
    recentBlockhash: any
    add() { return this }
    serialize() { return Buffer.from('transaction') }
  }
  return {
    PublicKey,
    Transaction,
    SystemProgram: { programId: new PublicKey('system'), transfer: vi.fn(() => ({})) },
    LAMPORTS_PER_SOL: 1_000_000_000,
    SYSVAR_RENT_PUBKEY: new PublicKey('rent'),
  }
})

vi.mock('../src/lib/anchor', () => ({ getProgram: mocks.getProgram }))
vi.mock('../src/lib/transactions', () => ({
  buildTransactionWithComputeBudget: vi.fn(() => ({})),
  sendTransaction: mocks.sendTransaction,
  getAssociatedTokenAddressSync: vi.fn(() => ({ toBase58: () => 'ata' })),
  createAssociatedTokenAccountInstruction: vi.fn(() => ({})),
  createSyncNativeInstruction: vi.fn(() => ({})),
  TOKEN_PROGRAM_ID: 'token-program',
  ASSOCIATED_TOKEN_PROGRAM_ID: 'associated-token-program',
}))
vi.mock('../src/lib/api', () => ({ api: { post: mocks.apiPost } }))

const depositParams = { vaultAddress: 'vault', tokenMint: 'SOL', amount: 1.25, vaultId: 'v1' }
const withdrawParams = { vaultAddress: 'vault', shareAmount: 2.5, vaultId: 'v1' }
const tradeParams = {
  vaultId: 'v1', inputToken: 'SOL', outputToken: 'USDC', amountIn: 5,
  amountOut: 100, priceAtExecution: 20, slippage: 0.5,
}

function program() {
  return {
    programId: 'program',
    idl: { instructions: [{}] },
    methods: {
      deposit: vi.fn(() => ({ accounts: vi.fn(() => ({ instruction: mocks.depositInstruction })) })),
      withdraw: vi.fn(() => ({ accounts: vi.fn(() => ({ instruction: mocks.withdrawInstruction })) })),
      executeTradePyth: vi.fn(() => ({ accounts: vi.fn(() => ({ instruction: mocks.tradeInstruction })) })),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.walletConnected = true
  mocks.anchorWalletConnected = true
  mocks.addTransaction.mockReturnValue('tx-1')
  mocks.getProgram.mockResolvedValue(program())
  mocks.getAccountInfo.mockResolvedValue(null)
  mocks.sendTransaction.mockResolvedValue('chain-signature')
  mocks.sendRawTransaction.mockResolvedValue('withdraw-signature')
  mocks.signTransaction.mockImplementation(async (transaction) => transaction)
  mocks.apiPost.mockResolvedValue({})
})

describe('useDeposit', () => {
  it('returns the on-chain signature', async () => {
    const { result } = renderHook(() => useDeposit())
    await expect(result.current.execute(depositParams)).resolves.toBe('chain-signature')
  })

  it('records the deposit payload', async () => {
    const { result } = renderHook(() => useDeposit())
    await result.current.execute(depositParams)
    expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'deposit', vaultId: 'v1', amountIn: 1.25 }))
  })

  it('transitions from pending to success', async () => {
    const { result } = renderHook(() => useDeposit())
    await result.current.execute(depositParams)
    expect(mocks.updateStatus.mock.calls).toEqual([['tx-1', 'pending'], ['tx-1', 'success']])
  })

  it('fails when wallet is disconnected', async () => {
    mocks.walletConnected = false
    const { result } = renderHook(() => useDeposit())
    await expect(result.current.execute(depositParams)).rejects.toThrow('Wallet not connected')
    expect(mocks.updateStatus).toHaveBeenLastCalledWith('tx-1', 'failed', 'Wallet not connected')
  })

  it('fails when program is unavailable', async () => {
    mocks.getProgram.mockResolvedValue(null)
    const { result } = renderHook(() => useDeposit())
    await expect(result.current.execute(depositParams)).rejects.toThrow('Deposit program unavailable')
  })

  it('records transaction submission failures', async () => {
    mocks.sendTransaction.mockRejectedValue(new Error('RPC unavailable'))
    const { result } = renderHook(() => useDeposit())
    await expect(result.current.execute(depositParams)).rejects.toThrow('RPC unavailable')
    expect(mocks.updateStatus).toHaveBeenLastCalledWith('tx-1', 'failed', 'RPC unavailable')
  })
})

describe('useWithdraw', () => {
  it('returns the raw transaction signature', async () => {
    const { result } = renderHook(() => useWithdraw())
    await expect(result.current.execute(withdrawParams)).resolves.toBe('chain-signature')
  })

  it('records the withdraw payload and success transition', async () => {
    const { result } = renderHook(() => useWithdraw())
    await result.current.execute(withdrawParams)
    expect(mocks.addTransaction).toHaveBeenCalledWith(expect.objectContaining({ type: 'withdraw', amountIn: 2.5 }))
    expect(mocks.updateStatus.mock.calls).toEqual([['tx-1', 'pending'], ['tx-1', 'success']])
  })

  it('fails when wallet is disconnected', async () => {
    mocks.walletConnected = false
    const { result } = renderHook(() => useWithdraw())
    await expect(result.current.execute(withdrawParams)).rejects.toThrow('Wallet not connected')
    expect(mocks.updateStatus).toHaveBeenLastCalledWith('tx-1', 'failed', 'Wallet not connected')
  })

  it('fails when program is unavailable', async () => {
    mocks.getProgram.mockResolvedValue({ idl: { instructions: [] } })
    const { result } = renderHook(() => useWithdraw())
    await expect(result.current.execute(withdrawParams)).rejects.toThrow('Withdraw program unavailable')
  })

  it('records signing failures', async () => {
    mocks.sendTransaction.mockRejectedValue(new Error('User rejected'))
    const { result } = renderHook(() => useWithdraw())
    await expect(result.current.execute(withdrawParams)).rejects.toThrow('User rejected')
    expect(mocks.updateStatus).toHaveBeenLastCalledWith('tx-1', 'failed', 'User rejected')
  })
})

describe('useExecuteTrade', () => {
  it('confirms and archives a successful trade', async () => {
    const { result } = renderHook(() => useExecuteTrade())
    await act(() => result.current.execute(tradeParams))
    expect(mocks.confirmTransaction).toHaveBeenCalledWith('tx-1', 'chain-signature')
    expect(mocks.moveToHistory).toHaveBeenCalledWith('tx-1')
  })

  it('syncs the successful trade to the backend', async () => {
    const { result } = renderHook(() => useExecuteTrade())
    await act(() => result.current.execute(tradeParams))
    expect(mocks.apiPost).toHaveBeenCalledWith('/trades/sync', expect.objectContaining({ signature: 'chain-signature', vault_id: 'v1', trade_type: 'Sell' }))
  })

  it('transitions through loading state', async () => {
    let release!: (signature: string) => void
    mocks.sendTransaction.mockReturnValue(new Promise((resolve) => { release = resolve }))
    const { result } = renderHook(() => useExecuteTrade())
    let execution!: Promise<void>
    act(() => { execution = result.current.execute(tradeParams) })
    expect(result.current.isLoading).toBe(true)
    await act(async () => { release('chain-signature'); await execution })
    expect(result.current.isLoading).toBe(false)
  })

  it('keeps a confirmed trade when backend sync fails', async () => {
    mocks.apiPost.mockRejectedValue(new Error('backend down'))
    const { result } = renderHook(() => useExecuteTrade())
    await act(() => result.current.execute(tradeParams))
    expect(mocks.moveToHistory).toHaveBeenCalledWith('tx-1')
    expect(mocks.updateStatus).not.toHaveBeenCalledWith('tx-1', 'failed', expect.anything())
  })

  it('fails when wallet is disconnected', async () => {
    mocks.anchorWalletConnected = false
    const { result } = renderHook(() => useExecuteTrade())
    await expect(act(() => result.current.execute(tradeParams))).rejects.toThrow('no on-chain signature')
    expect(mocks.updateStatus).toHaveBeenLastCalledWith('tx-1', 'failed', expect.stringContaining('no on-chain signature'))
  })

  it('fails when program is unavailable', async () => {
    mocks.getProgram.mockResolvedValue(null)
    const { result } = renderHook(() => useExecuteTrade())
    await expect(act(() => result.current.execute(tradeParams))).rejects.toThrow('no on-chain signature')
  })

  it('fails when transaction submission returns no signature', async () => {
    mocks.sendTransaction.mockResolvedValue(null as any)
    const { result } = renderHook(() => useExecuteTrade())
    await expect(act(() => result.current.execute(tradeParams))).rejects.toThrow('no on-chain signature')
    expect(result.current.isLoading).toBe(false)
  })

  it('records on-chain exceptions as failed', async () => {
    mocks.tradeInstruction.mockRejectedValueOnce(new Error('instruction failed'))
    const { result } = renderHook(() => useExecuteTrade())
    await act(async () => {
      await expect(result.current.execute(tradeParams)).rejects.toThrow('instruction failed')
    })
    expect(mocks.updateStatus).toHaveBeenCalledWith('tx-1', 'failed', 'instruction failed')
  })
})
