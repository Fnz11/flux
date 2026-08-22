export interface TokenInfo {
  symbol: string
  name: string
  mint: string
  decimals: number
  color: string
  icon: string
}

export const DEFAULT_WHITELISTED_TOKENS = [
  'SOL',
  'USDC',
  'USDT',
  'JUP',
  'PYTH',
  'RAY',
  'ORCA',
  'KMNO',
  'DRIFT',
  'JTO',
  'mSOL',
  'RENDER',
  'HNT',
  'NOS',
  'WBTC',
  'WETH',
  'BLZE',
] as const

export type WhitelistedTokenSymbol = (typeof DEFAULT_WHITELISTED_TOKENS)[number]
export const DEFAULT_FOCUS_ASSETS_WHITELIST: string[] = [...DEFAULT_WHITELISTED_TOKENS]

export const TOKENS: TokenInfo[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    color: '#9945FF',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    color: '#2775CA',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    color: '#26A17B',
    icon: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',
  },
  {
    symbol: 'JUP',
    name: 'Jupiter',
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    decimals: 6,
    color: '#F1622B',
    icon: 'https://static.jup.ag/jup/icon.png',
  },
  {
    symbol: 'PYTH',
    name: 'Pyth Network',
    mint: 'HZ1Jov2PwbShAi4evWKGAkgg5qUpWVKidGiEw6JH5W73',
    decimals: 6,
    color: '#E6D7FF',
    icon: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
  },
  {
    symbol: 'RAY',
    name: 'Raydium',
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
    color: '#5AC4BE',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  },
  {
    symbol: 'ORCA',
    name: 'Orca',
    mint: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
    decimals: 6,
    color: '#FFE259',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  },
  {
    symbol: 'KMNO',
    name: 'Kamino Finance',
    mint: 'KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS',
    decimals: 6,
    color: '#00D092',
    icon: 'https://assets.coingecko.com/coins/images/35801/standard/Kamino_200x200.png',
  },
  {
    symbol: 'DRIFT',
    name: 'Drift Protocol',
    mint: 'DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7',
    decimals: 6,
    color: '#5A67D8',
    icon: 'https://assets.coingecko.com/coins/images/37509/standard/DRIFT.png',
  },
  {
    symbol: 'JTO',
    name: 'Jito',
    mint: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
    decimals: 9,
    color: '#84CC16',
    icon: 'https://assets.coingecko.com/coins/images/33228/standard/jto.png',
  },
  {
    symbol: 'mSOL',
    name: 'Marinade Staked SOL',
    mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
    decimals: 9,
    color: '#10B981',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png',
  },
  {
    symbol: 'RENDER',
    name: 'Render',
    mint: 'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
    decimals: 8,
    color: '#E11D48',
    icon: 'https://coin-images.coingecko.com/coins/images/11636/large/rndr.png',
  },
  {
    symbol: 'HNT',
    name: 'Helium',
    mint: 'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux',
    decimals: 8,
    color: '#0284C7',
    icon: 'https://assets.coingecko.com/coins/images/4284/standard/helium_logo_use.png',
  },
  {
    symbol: 'NOS',
    name: 'Nosana',
    mint: 'nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7',
    decimals: 6,
    color: '#10B981',
    icon: 'https://coin-images.coingecko.com/coins/images/22606/large/nosana.png',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped BTC (Portal)',
    mint: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
    decimals: 8,
    color: '#F59E0B',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether (Portal)',
    mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    decimals: 8,
    color: '#627EEA',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png',
  },
  {
    symbol: 'BLZE',
    name: 'BlazeStake',
    mint: 'BLZEEuZUBVqFhj8adcCFPJvPVCiCyVmh3hkJMrU8KuJA',
    decimals: 9,
    color: '#F97316',
    icon: 'https://coin-images.coingecko.com/coins/images/28362/large/blze.png',
  },
]

export const fallbackTokenMap: Record<string, TokenInfo> = {
  ...Object.fromEntries(TOKENS.map((t) => [t.symbol, t])),
  USD: {
    symbol: 'USD',
    name: 'US Dollar',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    color: '#2775CA',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
}

export function formatTokenSymbol(symbolOrMint: string, fallbackOverride?: string): string {
  if (!symbolOrMint) return fallbackOverride || ''
  const meta = getTokenMeta(symbolOrMint)
  if (meta && meta.symbol && meta.symbol.length <= 10) {
    return meta.symbol
  }
  if (fallbackOverride) return fallbackOverride
  if (symbolOrMint.length > 12) {
    return `${symbolOrMint.slice(0, 4)}...${symbolOrMint.slice(-4)}`
  }
  return symbolOrMint
}

export function getTokenMeta(symbolOrMint: string): TokenInfo {
  if (!symbolOrMint) {
    return {
      symbol: '',
      name: '',
      mint: '',
      decimals: 6,
      color: '#737373',
      icon: '',
    }
  }

  const cleanSymbol = symbolOrMint.trim().toUpperCase()
  const found = TOKENS.find(
    (t) => t.symbol.toUpperCase() === cleanSymbol || t.mint === symbolOrMint,
  )
  if (found) return found

  const fallback = fallbackTokenMap[cleanSymbol]
  if (fallback) return fallback

  const isLongAddress = symbolOrMint.length > 20
  const isShares = cleanSymbol === 'SHARES' || isLongAddress
  const displaySymbol = isLongAddress
    ? `${symbolOrMint.slice(0, 4)}...${symbolOrMint.slice(-4)}`
    : cleanSymbol

  return {
    symbol: displaySymbol,
    name: isShares ? 'Vault Shares' : cleanSymbol,
    mint: isLongAddress ? symbolOrMint : '',
    decimals: 6,
    color: '#FF5C00',
    icon: '/logo.png',
  }
}

export function isWhitelistedToken(symbolOrMint: string): boolean {
  if (!symbolOrMint) return false
  const clean = symbolOrMint.trim().toUpperCase()
  return (
    clean !== 'BONK' &&
    (DEFAULT_WHITELISTED_TOKENS.some((s) => s.toUpperCase() === clean) ||
      TOKENS.some((t) => t.mint === symbolOrMint))
  )
}

