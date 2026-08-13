import {
  LayoutDashboard,
  Wallet,
  LineChart,
  HandCoins,
  ArrowRightLeft,
  Gift,
  BookOpen,
  Medal,
} from 'lucide-react'

export const managerLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vaults', label: 'Vaults', icon: Wallet },
  { to: '/payout', label: 'Payout', icon: HandCoins },
  { to: '/trade', label: 'Trade', icon: ArrowRightLeft },
] as const

export const investLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invest', label: 'Invest', icon: HandCoins },
  { to: '/portfolio', label: 'Portfolio', icon: LineChart },
] as const

export const campaignLinks = [
  { to: '#', label: 'Learn & earn', icon: BookOpen },
  { to: '#', label: 'Airdrops', icon: Gift },
  { to: '#', label: 'Rewards', icon: Medal },
] as const
