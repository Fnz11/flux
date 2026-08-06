// ── Domain enums ──
export type VaultStatus = 'Fundraising' | 'Active' | 'Dormant'
export type TransactionType = 'deposit' | 'withdraw' | 'trade'
export type TransactionStatus = 'pending' | 'success' | 'failed'
export type TradeType = 'Buy' | 'Sell' | 'Deposit' | 'Withdraw'

// ── Transaction (local state) ──
export interface Transaction {
  id: string
  type: TransactionType
  status: TransactionStatus
  signature: string | null
  vaultId: string | null
  timestamp: number
  errorMessage: string | null
  inputToken?: string
  outputToken?: string
  amountIn?: number
  amountOut?: number
}

// ── Vault metadata ──
export interface VaultMetadata {
  focusAssets: string[]
  description: string
  displayName: string
}

// ── Vault (frontend display) ──
export interface Vault {
  id: string
  address: string
  managerAddress: string
  managerId: string
  status: VaultStatus
  metadata: VaultMetadata
  performanceFeeBps: number
  managementFeeBps: number
  tvl: number
  createdAt: string
  updatedAt: string
  pnlPercent?: number
  minRaiseAmount?: number
  lockupPeriod?: number
  investorCount?: number
}

// ── Portfolio position ──
export interface PortfolioPosition {
  vaultId: string
  vaultAddress: string
  vaultName: string
  sharesOwned: number
  totalInvested: number
  averageEntryPrice: number
  currentValue: number
  pnl: number
  pnlPercent: number
}

// ── App config ──
export interface AppConfig {
  dustThreshold: number
  focusAssetsWhitelist: string[]
  minRaiseAmount: number
  lockupPeriod: number
}

// ── WebSocket message (legacy) ──
export interface WSMessage {
  type: 'TX_CONFIRMED' | 'TRADE_EXECUTED' | 'VAULT_UPDATED' | 'PRICE_UPDATE'
  vaultId?: string
  tradeId?: string
  transactionId?: string
  signature?: string
  status?: TransactionStatus
  errorMessage?: string
  payload?: Record<string, unknown>
}

// ═══════════════════════════════════════
//  API RESPONSE TYPES (snake_case JSON)
// ═══════════════════════════════════════

export interface ApiVault {
  id: string
  address: string
  manager_id: string
  manager_address: string
  status: VaultStatus
  metadata: VaultMetadata
  performance_fee_bps: number
  management_fee_bps: number
  tvl: number
  created_at: string
  updated_at: string
}

export interface ApiVaultListResponse {
  vaults: ApiVault[]
  total: number
}

export interface ApiTrade {
  id: string
  vault_id: string
  actor_id: string
  transaction_signature: string
  trade_type: TradeType
  input_token: string
  output_token: string
  amount_in: number
  amount_out: number
  price_at_execution: number
  executed_at: string
}

export interface ApiTradeHistoryResponse {
  trades: ApiTrade[]
  vault_id: string
}

export interface ApiPortfolioPosition {
  id: string
  user_id: string
  vault_id: string
  vault_address: string
  vault_name: string
  shares_owned: number
  total_invested_value: number
  average_entry_price: number
  current_value: number
  pnl: number
  pnl_percent: number
  created_at: string
  updated_at: string
}

export interface ApiPortfolioResponse {
  positions: ApiPortfolioPosition[]
  wallet: string
}

export interface ApiConfig {
  dust_threshold: number
  focus_assets_whitelist: string[]
}

export interface ApiFee {
  vault_id: string
  accrued_performance_fee: number
  accrued_management_fee: number
  total_accrued: number
}

// ═══════════════════════════════════════
//  REQUEST TYPES
// ═══════════════════════════════════════

export interface SyncTradeRequest {
  vault_id: string
  transaction_signature: string
  trade_type: TradeType
  input_token: string
  output_token: string
  amount_in: number
  amount_out: number
  price_at_execution: number
}

export interface UpdateVaultMetadataRequest {
  display_name?: string
  description?: string
  focus_assets?: string[]
}

// ═══════════════════════════════════════
//  WEBHOOK / WS MESSAGE TYPES
// ═══════════════════════════════════════

export type WsMessageType =
  | 'update'
  | 'trade_confirmed'
  | 'portfolio_update'
  | 'price_update'
  | 'heartbeat'
  | 'error'

export interface WsMessage<T = unknown> {
  type: WsMessageType
  data: T
  timestamp: number
}

export interface WsUpdateData {
  vault_id: string
}

export interface WsTradeConfirmedData {
  vault_id: string
  signature: string
  status: 'success' | 'failed'
  trade_type?: TradeType
  input_token?: string
  output_token?: string
  amount_in?: number
  amount_out?: number
}

export interface WsPortfolioUpdateData {
  wallet: string
  vault_id: string
  shares_owned: number
  total_invested_value: number
  average_entry_price: number
  current_value: number
  pnl: number
  pnl_percent: number
}

export interface WsPriceUpdateData {
  prices: Record<string, number>
}

export interface WsErrorData {
  code: string
  message: string
}
