export const DEFAULT_COLORS = [
  '#FA9A63',
  '#CDA63C',
  '#F6B253',
  '#FFD99F',
  '#3086ff',
  '#28C840',
  '#FF5F57',
  '#FFBD2E',
] as const

export const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 2.0] as const
export const BPS_PRESETS = ['10', '50', '100'] as const
export const PORTFOLIO_SORT_KEYS = ['value', 'pnl', 'name'] as const
export type PortfolioSortKey = (typeof PORTFOLIO_SORT_KEYS)[number]
