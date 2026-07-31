# FBYT-Clone: Smart Contract Execution Plan (Solana Anchor 1.0)

## Purpose

Non-custodial vault-based investment platform on Solana Devnet. Managers create
vaults, execute Pyth Oracle AMM trades, collect fees. Investors deposit SOL/USDC,
receive share tokens, withdraw in-kind assets. The Anchor 1.0 program manages
PDAs (vault state, token accounts), integrates Pyth pull oracle for live prices,
and emits events for backend indexing.

## Current State

All four instructions are implemented, compiled, and emit typed Anchor events.
Rust LiteSVM tests are next (see Testing section). The codebase uses Anchor 1.0
conventions: `AccountConstraints` suffix on account structs, `token_interface`
for token CPIs, no `freeze_authority` on share token mints.

---

## File Tree

```
contracts/
├── Anchor.toml
├── tsconfig.json
├── migrations/
│   └── deploy.ts
├── anchor/
│   └── package.json
├── programs/
│   └── fbyt-clone-vault/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── constants.rs
│           ├── errors.rs
│           ├── state.rs
│           ├── pyth_price.rs
│           └── instructions/
│               ├── mod.rs
│               ├── initialize_vault.rs
│               ├── deposit.rs
│               ├── withdraw.rs
│               └── execute_trade_pyth.rs
└── tests/
    └── fbyt_clone_vault.ts (DELETED)
```

Key differences from the initial scaffolding:
- `pyth_price.rs` extracted as a shared module for Pyth price reading and
  `calculate_amount_out` math.
- `state.rs` re-exports `VaultState` and `VaultStatusCode` from
  `instructions::initialize_vault` (single source of truth).
- All four event structs (`VaultInitialized`, `Deposited`, `Withdrawn`,
  `TradeExecuted`) live in `initialize_vault.rs`.
- TypeScript test file deleted; test strategy moved to Rust LiteSVM.

---

## Modules and Naming

### Account struct naming

Every `#[derive(Accounts)]` struct uses the `AccountConstraints` suffix:

| Instruction | Account Struct |
|---|---|
| `initialize_vault` | `InitializeVaultAccountConstraints` |
| `deposit` | `DepositAccountConstraints` |
| `withdraw` | `WithdrawAccountConstraints` |
| `execute_trade_pyth` | `ExecuteTradePythAccountConstraints` |

In `lib.rs`, handler types are referenced fully qualified:
```rust
ctx: Context<instructions::initialize_vault::InitializeVaultAccountConstraints>
```

### Token CPIs

All token operations use `anchor_spl::token_interface` (not `anchor_spl::token`):
- `Interface<'info, TokenInterface>` instead of `Program<'info, Token>`
- `InterfaceAccount<'info, Mint>` / `InterfaceAccount<'info, TokenAccount>`
- CPI helpers: `transfer_checked`, `mint_to`, `burn` from `token_interface`

### Constants (`constants.rs`)

```rust
pub const VAULT_SEED: &[u8] = b"vault";
pub const VAULT_AUTHORITY_SEED: &[u8] = b"vault_authority";
pub const MAXIMUM_AGE: u64 = 60;
pub const SHARE_TOKEN_DECIMALS: u8 = 9;
pub const SHARE_TOKEN_NAME: &str = "FBYT Share";
pub const SHARE_TOKEN_SYMBOL: &str = "FSHR";
```

### Errors (`errors.rs`)

```rust
#[error_code]
pub enum VaultError {
    Unauthorized,
    InvalidPythFeed,
    MathOverflow,
    StalePrice,
    VaultLocked,
    MinRaiseNotMet,
    LockupActive,
    InsufficientVaultBalance,
    InvalidTradeParams,
    InvalidAmount,
    FeeTooHigh,
}
```

`InvalidAmount` and `FeeTooHigh` added during implementation.

---

## State

### VaultState

Defined in `instructions/initialize_vault.rs`, re-exported via `state.rs`:

```rust
#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub manager: Pubkey,
    pub min_raise_amount: u64,
    pub performance_fee_bps: u16,
    pub management_fee_bps: u16,
    pub lockup_period: i64,
    pub total_shares_minted: u64,
    pub total_assets_deposited: u64,
    pub vault_bump: u8,
    pub vault_authority_bump: u8,
    pub status: VaultStatusCode,
    pub created_at: i64,
    pub last_trade_at: i64,
}
```

### VaultStatusCode

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum VaultStatusCode {
    Fundraising,
    Active,
    Dormant,
}
```

### Seed derivation

- Vault PDA: `seeds = [b"vault", manager.key().as_ref()]`
- Vault Authority PDA: `seeds = [b"vault_authority", vault.key().as_ref()]`

### Share token mint

Created during `initialize_vault`. Uses `mint::authority = vault_authority`
(no separate freeze authority). Vault authority PDA is the mint authority and
signs all `mint_to` and `burn` CPIs via PDA signer seeds.

---

## Instructions

### initialize_vault

**handler**: `initialize_vault(min_raise_amount, performance_fee_bps, management_fee_bps, lockup_period)`

- Creates the `VaultState` PDA, share token mint, and vault authority PDA.
- Validates combined fee cap: `performance_fee + management_fee <= 10000` bps.
- Sets `status = Fundraising`, records `created_at` and `last_trade_at`.
- Emits `VaultInitialized` event.

### deposit

**handler**: `deposit(amount)`

- Accepts SOL or SPL tokens. Investor provides `investor_token_account`,
  `vault_token_account`, and `deposit_mint`.
- Share price calculation (u128 checked arithmetic, no floats):
  - First deposit: `shares_to_mint = amount` (1:1 ratio)
  - Subsequent: `shares_to_mint = (amount * total_shares) / total_assets`
- Vault authority signs the `mint_to` CPI via PDA seeds.
- Emits `Deposited` event.

### withdraw

**handler**: `withdraw(shares_to_burn)`

- Requires `amount > 0`, sufficient share balance.
- Lockup enforcement: if `lockup_period > 0`, checks
  `clock.unix_timestamp >= created_at + lockup_period`.
- Proportional withdrawal: `amount_out = (shares_to_burn * total_assets) / total_shares`
- User burns their own shares (no PDA signer needed).
- Vault authority signs the `transfer_checked` CPI via PDA seeds.
- Emits `Withdrawn` event.

### execute_trade_pyth

**handler**: `execute_trade_pyth(amount_in, min_amount_out)`

- Manager-only. Requires `vault.status == Active`.
- Reads live Pyth price from `PriceUpdateV2` account via
  `get_price_no_older_than` (max age: `MAXIMUM_AGE` = 60 seconds).
- Price math: `amount_out = amount_in * price` with exponent scaling
  (u128 checked arithmetic, handles both positive and negative exponents).
- Slippage protection: `amount_out >= min_amount_out`.
- Burns `amount_in` of input token, mints `amount_out` of output token.
- Vault authority signs both burn and mint CPIs via PDA seeds.
- Emits `TradeExecuted` event with raw `price` + `price_exponent` fields.

---

## Events

All four events are declared in `instructions/initialize_vault.rs`:

```rust
#[event] pub struct VaultInitialized { vault, manager, min_raise_amount, performance_fee_bps, management_fee_bps, lockup_period, share_token_mint }
#[event] pub struct Deposited { vault, investor, amount, shares_minted, token_mint }
#[event] pub struct Withdrawn { vault, investor, shares_burned, amount_out, token_mint }
#[event] pub struct TradeExecuted { vault, manager, input_mint, output_mint, amount_in, amount_out, price, price_exponent, feed_id }
```

---

## Shared Module: pyth_price.rs

Extracted to avoid duplicating Pyth read logic across instructions:

```rust
pub fn read_pyth_price(price_update: &Account<PriceUpdateV2>) -> Result<PythPriceResult>
pub fn calculate_amount_out(amount_in: u64, price: i64, expo: i32) -> Result<u64>
```

Not currently used (the trade handler inlines the same logic directly). Can be
adopted when a second instruction needs Oracle prices.

---

## Configuration

### Cargo.toml

```toml
anchor-lang = { version = "1.0.2", features = ["init-if-needed"] }
anchor-spl = { version = "1.0.2", features = ["idl-build"] }
pyth-solana-receiver-sdk = "0.7.0"
```

### Anchor.toml

```toml
[programs.devnet]
fbyt_clone_vault = "FBYT1111111111111111111111111111111111111"

[provider]
cluster = "Localnet"

[scripts]
test = "cargo test"
```

### package.json (npm, not yarn)

```json
{
  "scripts": {
    "build": "anchor build",
    "deploy:devnet": "anchor deploy --provider.cluster devnet",
    "test": "cargo test"
  },
  "devDependencies": {
    "@anchor-lang/core": "^1.0.2"
  }
}
```

---

## Testing

Tests use Rust LiteSVM (not TypeScript). Run with:

```sh
anchor test       # or: cargo test
```

LiteSVM test files go in `programs/fbyt-clone-vault/tests/` as Rust
integration tests. Each test creates a LiteSVM environment, deploys the
program, derives PDAs, sends transactions, and asserts state changes.

### Planned test cases

1. Initialize vault - verify VaultState fields, share token mint creation
2. Deposit SOL - verify token transfer and share minting with correct ratio
3. Deposit USDC - same flow via SPL token
4. Multiple deposits - verify proportional share math across investors
5. Withdrawal after lockup - warp time, verify burn and asset return
6. Withdrawal before lockup - expect LockupActive error
7. Withdrawal without lockup (lockup = 0) - immediate withdrawal succeeds
8. Pyth trade - mock PriceUpdateV2, verify burn/mint amounts match oracle
9. Unauthorized access - non-manager trade expects Unauthorized
10. Fee cap validation - combined fee > 10000 bps expects FeeTooHigh

---

## Deployment

```sh
npm run deploy:devnet
```

Program ID: `FBYT1111111111111111111111111111111111111` (Devnet)
