const ANCHOR_VAULT_ERRORS: Record<number, string> = {
  6000: 'Only the vault manager can perform this action (Unauthorized)',
  6001: 'Invalid Pyth price feed account',
  6002: 'Math overflow or underflow detected',
  6003: 'Pyth price is too old / stale',
  6004: 'Vault is currently in Fundraising phase and not active yet',
  6005: 'Minimum raise amount not met to activate vault',
  6006: 'Withdrawal lockup period has not ended yet',
  6007: 'Insufficient vault balance for operation',
  6008: 'Invalid trade parameters',
  6009: 'Amount must be greater than zero',
  6010: 'Fee exceeds maximum allowed (100%)',
  6011: 'Invalid token mint: token is not in vault focus assets whitelist',
  6012: 'Subtraction underflow',
  6013: 'Multiplication overflow',
  6014: 'Division by zero',
  6015: 'Type cast overflow',
  6016: 'Price confidence interval is too wide',
  6017: 'Invalid price feed for token mint',
  6018: 'Vault is currently paused',
  6019: 'Share token mint mismatch',
}

const ANCHOR_FRAMEWORK_ERRORS: Record<number, string> = {
  3000: 'Account missing',
  3001: 'Account does not exist',
  3002: 'Failed to serialize account',
  3003: 'Failed to deserialize account',
  3007: 'Account owned by wrong program',
  3012: 'Account not initialized on-chain',
}

export function formatError(err: unknown, fallback: string = 'An unexpected error occurred'): string {
  if (!(err instanceof Error)) return fallback
  if (err.message === '') return ''

  let str = err.message
  if ('logs' in err && Array.isArray((err as unknown as { logs: string[] }).logs)) {
    str += ' ' + (err as unknown as { logs: string[] }).logs.join(' ')
  }

  if (
    str.includes('User rejected the request') ||
    str.includes('Transaction cancelled') ||
    str.includes('rejected by user')
  ) {
    return 'Transaction rejected by user'
  }

  if (str.includes('0x1') || str.includes('insufficient lamports') || str.includes('Insufficient funds')) {
    return 'Insufficient SOL in wallet to pay transaction fees or rent'
  }

  const msgMatch = str.match(/Error Message:\s*([^.\n]+)/i)
  if (msgMatch && msgMatch[1]) {
    const rawMsg = msgMatch[1].trim()
    if (rawMsg) return rawMsg
  }

  const customNumMatch = str.match(/(?:Custom|Error Number):\s*(\d+)/i)
  if (customNumMatch && customNumMatch[1]) {
    const code = parseInt(customNumMatch[1], 10)
    if (ANCHOR_VAULT_ERRORS[code]) return ANCHOR_VAULT_ERRORS[code]
    if (ANCHOR_FRAMEWORK_ERRORS[code]) return ANCHOR_FRAMEWORK_ERRORS[code]
  }

  const hexMatch = str.match(/custom program error:\s*(0x[0-9a-fA-F]+)/i)
  if (hexMatch && hexMatch[1]) {
    const code = parseInt(hexMatch[1], 16)
    if (ANCHOR_VAULT_ERRORS[code]) return ANCHOR_VAULT_ERRORS[code]
    if (ANCHOR_FRAMEWORK_ERRORS[code]) return ANCHOR_FRAMEWORK_ERRORS[code]
  }

  const codeNameMatch = str.match(/Error Code:\s*([a-zA-Z0-9_]+)/i)
  if (codeNameMatch && codeNameMatch[1]) {
    const name = codeNameMatch[1].trim()
    switch (name) {
      case 'InvalidMint':
        return 'Invalid token mint: token is not in vault focus assets whitelist'
      case 'VaultLocked':
        return 'Vault is currently in Fundraising phase and not active yet'
      case 'MinRaiseNotMet':
        return 'Minimum raise amount not met'
      case 'AccountNotInitialized':
        return 'Vault or oracle account is not initialized on-chain'
      case 'AccountOwnedByWrongProgram':
        return 'Account owned by wrong program'
      case 'AccountDidNotDeserialize':
        return 'Failed to deserialize account structure'
      case 'Unauthorized':
        return 'Only the vault manager can perform this action'
      case 'InsufficientVaultBalance':
        return 'Insufficient vault balance for operation'
      default:
        return `Contract error: ${name}`
    }
  }

  const cleaned = str.replace(/^Error:\s*/i, '').trim()
  if (cleaned && cleaned.length < 200 && !cleaned.startsWith('{')) {
    return cleaned
  }

  return fallback
}
