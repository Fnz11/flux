import { describe, it, expect } from 'vitest'
import {
  formatError,
  ANCHOR_VAULT_ERRORS,
  ANCHOR_VAULT_ERROR_NAMES,
} from '@/lib/errors'

describe('Anchor Vault Errors Mapping (6000 - 6020)', () => {
  const ERROR_SPECS: Array<{ code: number; hex: string; name: string; expectedSubstring: string }> = [
    { code: 6000, hex: '0x1770', name: 'Unauthorized', expectedSubstring: 'Only the vault manager' },
    { code: 6001, hex: '0x1771', name: 'InvalidPythFeed', expectedSubstring: 'Invalid Pyth price feed' },
    { code: 6002, hex: '0x1772', name: 'MathOverflow', expectedSubstring: 'Math overflow' },
    { code: 6003, hex: '0x1773', name: 'StalePrice', expectedSubstring: 'Pyth price is too old' },
    { code: 6004, hex: '0x1774', name: 'VaultLocked', expectedSubstring: 'Fundraising phase' },
    { code: 6005, hex: '0x1775', name: 'MinRaiseNotMet', expectedSubstring: 'Minimum raise amount not met' },
    { code: 6006, hex: '0x1776', name: 'LockupActive', expectedSubstring: 'Withdrawal lockup period' },
    { code: 6007, hex: '0x1777', name: 'InsufficientVaultBalance', expectedSubstring: 'Insufficient vault balance' },
    { code: 6008, hex: '0x1778', name: 'InvalidTradeParams', expectedSubstring: 'Invalid trade parameters' },
    { code: 6009, hex: '0x1779', name: 'InvalidAmount', expectedSubstring: 'Amount must be greater than zero' },
    { code: 6010, hex: '0x177a', name: 'FeeTooHigh', expectedSubstring: 'Fee exceeds maximum allowed' },
    { code: 6011, hex: '0x177b', name: 'InvalidMint', expectedSubstring: 'Invalid token mint' },
    { code: 6012, hex: '0x177c', name: 'SubtractionUnderflow', expectedSubstring: 'Subtraction underflow' },
    { code: 6013, hex: '0x177d', name: 'MultiplicationOverflow', expectedSubstring: 'Multiplication overflow' },
    { code: 6014, hex: '0x177e', name: 'DivisionByZero', expectedSubstring: 'Division by zero' },
    { code: 6015, hex: '0x177f', name: 'CastOverflow', expectedSubstring: 'Type cast overflow' },
    { code: 6016, hex: '0x1780', name: 'PriceConfidenceTooWide', expectedSubstring: 'Price confidence interval is too wide' },
    { code: 6017, hex: '0x1781', name: 'InvalidPriceFeedForMint', expectedSubstring: 'Invalid price feed for token mint' },
    { code: 6018, hex: '0x1782', name: 'VaultPaused', expectedSubstring: 'Vault is currently paused' },
    { code: 6019, hex: '0x1783', name: 'ShareMintMismatch', expectedSubstring: 'Share token mint mismatch' },
    { code: 6020, hex: '0x1784', name: 'TooManyOutputMints', expectedSubstring: 'Too many output mints allowed' },
  ]

  it('contains all 21 contract error codes in ANCHOR_VAULT_ERRORS', () => {
    expect(Object.keys(ANCHOR_VAULT_ERRORS)).toHaveLength(21)
    for (const spec of ERROR_SPECS) {
      expect(ANCHOR_VAULT_ERRORS[spec.code]).toBeDefined()
      expect(ANCHOR_VAULT_ERRORS[spec.code]).toContain(spec.expectedSubstring)
    }
  })

  it('contains all 21 contract error names in ANCHOR_VAULT_ERROR_NAMES', () => {
    expect(Object.keys(ANCHOR_VAULT_ERROR_NAMES)).toHaveLength(21)
    for (const spec of ERROR_SPECS) {
      expect(ANCHOR_VAULT_ERROR_NAMES[spec.name]).toBeDefined()
      expect(ANCHOR_VAULT_ERROR_NAMES[spec.name]).toContain(spec.expectedSubstring)
    }
  })

  describe('formats errors by decimal error number (Custom: 60xx)', () => {
    for (const spec of ERROR_SPECS) {
      it(`formats decimal code ${spec.code} (${spec.name})`, () => {
        const err = new Error(`Transaction failed: {"InstructionError":[2,{"Custom":${spec.code}}]}`)
        const formatted = formatError(err)
        expect(formatted).toContain(spec.expectedSubstring)
      })
    }
  })

  describe('formats errors by hex error code (0x17xx)', () => {
    for (const spec of ERROR_SPECS) {
      it(`formats hex code ${spec.hex} (${spec.name})`, () => {
        const err = new Error(`Transaction simulation failed: Error processing Instruction 2: custom program error: ${spec.hex}`)
        const formatted = formatError(err)
        expect(formatted).toContain(spec.expectedSubstring)
      })
    }
  })

  describe('formats errors by Anchor error code name (Error Code: <Name>)', () => {
    for (const spec of ERROR_SPECS) {
      it(`formats error name ${spec.name}`, () => {
        const err = new Error(`Program log: AnchorError thrown in src/instructions/withdraw.rs:77. Error Code: ${spec.name}. Error Number: ${spec.code}.`)
        const formatted = formatError(err)
        expect(formatted).toContain(spec.expectedSubstring)
      })
    }
  })

  describe('formats errors by explicit Error Message from contract logs', () => {
    it('extracts Error Message from Anchor log', () => {
      const err = new Error('Program log: AnchorError thrown in src/instructions/withdraw.rs:77. Error Code: LockupActive. Error Number: 6006. Error Message: Withdrawal lockup period has not ended.')
      expect(formatError(err)).toBe('Withdrawal lockup period has not ended')
    })
  })

  describe('formats Anchor Framework errors (3000-3012)', () => {
    it('formats AccountNotInitialized (3012)', () => {
      const err = new Error('custom program error: 0xbc4')
      expect(formatError(err)).toBe('Account not initialized on-chain')
    })

    it('formats AccountNotInitialized by name', () => {
      const err = new Error('Error Code: AccountNotInitialized')
      expect(formatError(err)).toBe('Vault or oracle account is not initialized on-chain')
    })
  })

  describe('formats common client & wallet errors', () => {
    it('formats user rejection', () => {
      const err = new Error('User rejected the request.')
      expect(formatError(err)).toBe('Transaction rejected by user')
    })

    it('formats insufficient SOL balance', () => {
      const err = new Error('Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1')
      expect(formatError(err)).toBe('Insufficient SOL in wallet to pay transaction fees or rent')
    })

    it('handles non-Error objects with fallback', () => {
      expect(formatError(null)).toBe('An unexpected error occurred')
      expect(formatError(undefined)).toBe('An unexpected error occurred')
      expect(formatError('string error')).toBe('An unexpected error occurred')
    })

    it('returns custom fallback when provided', () => {
      expect(formatError(null, 'Withdrawal failed')).toBe('Withdrawal failed')
    })
  })
})
