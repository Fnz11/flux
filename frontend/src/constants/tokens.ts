export interface TokenInfo {
  symbol: string
  name: string
  mint: string
  decimals: number
  color: string
  icon: string
}

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
