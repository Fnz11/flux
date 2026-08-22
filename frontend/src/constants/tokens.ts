export interface TokenInfo {
  symbol: string
  name: string
  mint: string
  decimals: number
  color: string
  icon: string
}

export const DEFAULT_WHITELISTED_TOKENS = ['SOL', 'USDC', 'USDT', 'JUP', 'PYTH'] as const
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
]

export const fallbackTokenMap: Record<string, TokenInfo> = {
  SOL: TOKENS[0],
  USDC: TOKENS[1],
  USDT: TOKENS[2],
  JUP: TOKENS[3],
  PYTH: TOKENS[4],
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
