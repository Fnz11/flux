# adjustment-2.md — Whirlpools vs fbyt-clone-vault: Enterprise Grade Analysis

> **Reviewer**: Lead Solana Protocol Engineer  
> **Date**: 2026-08-06  
> **Source A**: `/Users/macbookprom1/projects/whirlpools/programs/whirlpool/src/`  
> **Source B**: `./contracts/programs/fbyt-clone-vault/src/`  
> **Objective**: What Whirlpools does as an enterprise-grade Solana program that fbyt-clone-vault is missing — across architecture, security, math, testing, and operations.

---

## Table of Contents

1. [Architecture & Module Structure](#1-architecture--module-structure)
2. [State Design & Account Layout](#2-state-design--account-layout)
3. [Security Gaps](#3-security-gaps)
4. [Math Safety & Arithmetic Patterns](#4-math-safety--arithmetic-patterns)
5. [Error Handling Design](#5-error-handling-design)
6. [Fee System](#6-fee-system)
7. [Oracle Integration](#7-oracle-integration)
8. [Token Handling & CPI Safety](#8-token-handling--cpi-safety)
9. [Authority & Role Management](#9-authority--role-management)
10. [Event System](#10-event-system)
11. [Testing Strategy](#11-testing-strategy)
12. [Infrastructure & Developer Experience](#12-infrastructure--developer-experience)
13. [Prioritized Action Items](#13-prioritized-action-items)

---

## 1. Architecture & Module Structure

### What Whirlpools Does

Whirlpools organizes source code into deeply specialized subdirectories, each with a single clear responsibility:

```
src/
├── auth/           — Authority validation (admin roles, feature flags)
├── constants/      — Split into nft.rs, transfer_memo.rs, test_constants.rs
├── entrypoint.rs   — Pinocchio-optimized raw dispatcher
├── errors.rs       — 40+ granular typed errors
├── events.rs       — Full lifecycle event structs
├── instructions/   — 41+ handlers, each in its own file
├── manager/        — Business logic separated from account validation
│   ├── swap_manager.rs      (624KB of pure swap math)
│   ├── liquidity_manager.rs (164KB)
│   ├── fee_rate_manager.rs  (111KB)
│   └── tick_manager.rs      (31KB)
├── math/           — 9 dedicated math files (bit, swap, tick, token, U256)
├── pinocchio/      — Zero-overhead layer bypassing Anchor deserialization
├── state/          — 16 state files (one per account type)
└── util/           — token.rs, shared.rs, sparse_swap.rs, swap_tick_sequence.rs
```

**Key pattern**: Business logic lives in `manager/`, account validation lives in `instructions/`. They never mix. This is the Separation of Concerns principle at its strictest.

### What fbyt Has

```
src/
├── constants.rs      — 6 constants in one flat file
├── errors.rs         — 12 errors in one file
├── events.rs         — 4 events
├── instructions/     — 5 handlers, logic inside each handler directly
├── pyth_price.rs     — Oracle logic mixed into top-level module
├── state.rs          — All state in one flat file
└── utils.rs          — 1 helper function
```

### Gap Assessment

| Area | Whirlpools | fbyt | Gap Level |
|---|---|---|---|
| Business logic separation | Dedicated `manager/` layer | Logic inside handler | High |
| Math module | 9 files, dedicated per domain | Inline in handlers | High |
| Constants organization | Split by purpose | Single flat file | Medium |
| State files | 16 files, one per account | 1 file for all state | Medium |
| Pinocchio CU optimization | Separate low-level layer | Anchor only | Low (POC) |

### Recommendation for fbyt

Extract handler business logic into a `manager/` layer:

```
src/
├── manager/
│   ├── vault_manager.rs      — initialize, activate, pause logic
│   ├── deposit_manager.rs    — share math, NAV calculation
│   ├── withdraw_manager.rs   — redemption math, lockup check
│   └── trade_manager.rs      — price validation, mint/burn accounting
├── math/
│   ├── share_math.rs         — shares_to_mint, amount_out formulas
│   └── fee_math.rs           — performance fee, management fee accrual
```

---

## 2. State Design & Account Layout

### What Whirlpools Does

- **One account type per file**: `whirlpool.rs`, `position.rs`, `tick.rs`, `fee_tier.rs`, etc.
- **Invariant methods on structs**: e.g. `whirlpool.update_after_swap(...)`. State transitions are encapsulated inside the struct, not scattered across handlers.
- **Reserved padding**: Accounts allocate explicit reserved bytes so fields can be added without migrating accounts.
- **Token mint ordering enforcement**: `token_mint_a < token_mint_b` lexicographically. Eliminates duplicate pool creation.

### What fbyt Has

```rust
pub struct VaultState {
    pub manager: Pubkey,
    pub deposit_mint: Pubkey,
    pub allowed_output_mints: [Pubkey; 4],
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

### Critical Gaps in fbyt State

**Gap 1: `share_token_mint` Not Stored on `VaultState` — CRITICAL**

In `deposit.rs` and `withdraw.rs`, `share_token_mint` is validated with only:
```rust
#[account(mut, mint::authority = vault_authority)]
pub share_token_mint: InterfaceAccount<'info, Mint>,
```
This does NOT verify it is the correct share mint for this vault. An attacker could pass any mint where `vault_authority` is authority and get shares minted to them.

Fix — store it and validate:
```rust
// In VaultState:
pub share_token_mint: Pubkey,

// In deposit.rs constraint:
constraint = share_token_mint.key() == vault.share_token_mint @ VaultError::InvalidMint,
```

**Gap 2: No Reserved Space for Upgrades**

Whirlpool allocates explicit padding. fbyt uses `#[derive(InitSpace)]` with no reserved bytes. If you ever add a field to `VaultState`, you cannot without migrating all existing accounts.

Fix:
```rust
pub _reserved: [u8; 64],  // reserved for future upgrade fields
```

**Gap 3: No Per-Investor State**

No `InvestorPosition` PDA. Cannot enforce per-wallet deposit caps, individual lockup timestamps (vault lockup is global from `created_at`), or individual fee accounting.

**Gap 4: No Fee Accumulator Fields**

`performance_fee_bps` and `management_fee_bps` are stored but never used. No `accrued_performance_fee: u64` or `accrued_management_fee: u64` field accumulates anything.

---

## 3. Security Gaps

### 3.1 Share Token Mint Spoofing (Critical)

See Gap 1 above. Any mint where `vault_authority` holds authority could be passed.

Risk: Investor mints infinite fake shares → drains vault on withdrawal.

### 3.2 Synthetic Mint/Burn Trade Execution (Critical for Production)

`execute_trade_pyth.rs` currently simulates a trade by burning input tokens and minting output tokens:

```rust
burn(cpi_ctx, amount_in)?;    // destroys input tokens
mint_to(cpi_ctx, amount_out)?; // creates output tokens out of thin air
```

This only works if the vault PDA owns the mint authorities of BOTH token mints. In any real deployment (USDC, SOL, wBTC), the vault does NOT own those mint authorities. CPI would fail with `MintAuthorityMismatch`.

Real enterprise pattern: Perform a DEX CPI (Jupiter, Raydium, or Orca) using `invoke_signed`. The vault sends tokens to the DEX and receives output tokens back.

### 3.3 Decimal Mismatch in Price Calculation (High)

`calculate_amount_out` applies price and exponent only — ignores relative token decimal differences:

```rust
let val = (amount_in as u128)
    .checked_mul(price as u128)...
    .checked_div(divisor as u128)...
```

Swapping SOL (9 decimals) → USDC (6 decimals) gives output 1000x too small.

Fix:
```rust
pub fn calculate_amount_out(
    amount_in: u64,
    price: i64,
    expo: i32,
    input_decimals: u8,
    output_decimals: u8,
) -> Result<u64> {
    let decimal_adjustment = (output_decimals as i32) - (input_decimals as i32) + expo;
    // apply adjustment before or after price multiplication
}
```

### 3.4 Hardcoded Price Feed ID (High)

```rust
pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2...";
```

Always reads SOL/USD regardless of which mints are traded. If manager trades USDC → BTC, the price consulted is still SOL/USD.

Fix: Map mint → feed ID in `VaultState`, validate at runtime.

### 3.5 Lockup Is Global, Not Per-Investor (Medium)

```rust
let unlock_time = vault.created_at.checked_add(vault.lockup_period)?;
```

Every investor's lockup is measured from vault creation. Investor depositing 1 day before lockup expires gets almost zero protection.

Whirlpools pattern: Per-position state accounts (`Position` struct) with `opened_at` timestamp.

fbyt fix: `InvestorPosition` PDA (`seeds = [b"position", vault.key(), investor.key()]`) storing `deposited_at: i64`.

### 3.6 Pyth Price Confidence Interval Ignored (Medium)

`read_pyth_price` returns `conf` but it is never checked:
```rust
Ok(PythPriceResult {
    price: price.price,
    conf: price.conf,   // returned but never validated
    expo: price.exponent,
})
```

Standard: reject if `conf / price > 1%`:
```rust
require!(
    (price.conf as u128) * 100 <= (price.price.unsigned_abs() as u128),
    VaultError::PriceConfidenceTooWide
);
```

### 3.7 No Emergency Pause / Circuit Breaker (Medium)

Whirlpools has `TradeIsNotEnabled` and `FeatureIsNotEnabled` via `ConfigFeatureFlags` bitflags. fbyt has no mechanism to freeze a vault if the oracle is compromised or a bug is found.

Fix: Add `is_paused: bool` to `VaultState` + `pause_vault(ctx)` instruction callable only by manager.

### 3.8 Missing `security.txt` (Low)

Whirlpools embeds a `security.txt` into the deployed binary for whitehats and auditors. Standard practice for any public-facing Solana program.

---

## 4. Math Safety & Arithmetic Patterns

### What Whirlpools Does

| Pattern | Description |
|---|---|
| `AmountDeltaU64` enum | Wraps `Valid(u64)` vs `ExceedsMax(ErrorCode)` — clean overflow separation |
| Rounding direction flags | `round_up: bool` on all division — protocol rounds against user |
| Custom `U256Muldiv` | `[u64; 4]` for high-precision pricing without third-party deps |
| Granular error per overflow type | `MultiplicationOverflow`, `MulDivOverflow`, `DivideByZero`, `AmountCalcOverflow` |
| `From<TryFromIntError>` impl | Integer cast failures auto-convert to `NumberCastError` |

### What fbyt Has

```rust
.ok_or(crate::errors::VaultError::MathOverflow)?
```

Single `MathOverflow` for all arithmetic failures. No rounding control. Division truncates (floors), which can slightly favor attackers on share redemption edge cases.

### Recommendations

**Add granular math errors**:
```rust
#[error_code]
pub enum VaultError {
    MultiplicationOverflow,
    DivisionByZero,
    CastOverflow,
    SubtractionUnderflow,
    // ...
}
```

**Extract `src/math/share_math.rs`**:
```rust
/// Rounds DOWN — vault-favorable on share minting
pub fn calculate_shares_to_mint(amount: u64, total_shares: u64, total_assets: u64) -> Result<u64>

/// Rounds DOWN — vault-favorable on withdrawal
pub fn calculate_amount_out(shares: u64, total_shares: u64, total_assets: u64) -> Result<u64>
```

**Extract `src/math/fee_math.rs`**:
```rust
pub fn calculate_performance_fee(profit: u64, fee_bps: u16) -> Result<u64>
pub fn calculate_management_fee(assets: u64, fee_bps: u16, elapsed_days: u64) -> Result<u64>
```

---

## 5. Error Handling Design

### Whirlpools: 40+ Typed Errors by Subsystem

- Math: `NumberCastError`, `DivideByZero`, `MultiplicationOverflow`, `MulDivOverflow`, `AmountCalcOverflow`
- Tick/Price: `InvalidStartTick`, `SqrtPriceOutOfBounds`, `TickArrayIndexOutofBounds`
- Business logic: `LiquidityZero`, `FeeRateMaxExceeded`, `TradeIsNotEnabled`
- System: `MissingOrInvalidDelegate`, `FeatureIsNotEnabled`

`impl From<TryFromIntError> for ErrorCode` — cast failures auto-convert with just `?`.

### fbyt: 12 Flat Errors

Missing errors to add:

```rust
// Math precision
SubtractionUnderflow,
MultiplicationOverflow,
DivisionByZero,
CastOverflow,

// Oracle
PriceConfidenceTooWide,
InvalidPriceFeedForMint,
NegativePrice,

// Vault lifecycle
VaultAlreadyActive,
VaultPaused,

// Investor operations
ShareMintMismatch,           // share_token_mint != vault.share_token_mint
WithdrawMintNotDepositMint,

// Accounting
TotalSharesZero,             // cannot withdraw when total_shares == 0
```

---

## 6. Fee System

### Whirlpools

Two separate fee mechanisms with 128-bit Q64.64 growth accumulators — impossible to drain via rounding attacks. Protocol fees collected via separate authority and instruction.

### fbyt: Non-Functional Fee System

```rust
pub performance_fee_bps: u16,  // stored but never used
pub management_fee_bps: u16,   // stored but never used
// No accumulator. No collection instruction. Dead code.
```

### What to Implement

**Management Fee** (time-based AUM %):
```rust
let days_elapsed = (clock.unix_timestamp - vault.last_fee_accrual_at) / 86400;
let management_fee = total_assets * management_fee_bps as u64 * days_elapsed / 10000 / 365;
vault.accrued_management_fee += management_fee;
vault.last_fee_accrual_at = clock.unix_timestamp;
```

**Performance Fee** (profit above high-water mark):
```rust
let current_nav = total_assets_deposited / total_shares_minted;
if current_nav > vault.high_water_mark {
    let profit_per_share = current_nav - vault.high_water_mark;
    let performance_fee = profit_per_share * total_shares_minted * performance_fee_bps / 10000;
    vault.accrued_performance_fee += performance_fee;
    vault.high_water_mark = current_nav;
}
```

**New fields needed on `VaultState`**:
```rust
pub high_water_mark: u64,         // NAV per share baseline
pub accrued_performance_fee: u64,
pub accrued_management_fee: u64,
pub last_fee_accrual_at: i64,
```

**New instruction**: `collect_fees(ctx: Context<CollectFees>)` — callable only by manager.

---

## 7. Oracle Integration

### Whirlpools

Uses an on-chain TWAP Oracle (`oracle.rs`, 87KB) that accumulates `sqrt_price` observations over time. Manipulation-resistant by design — requires sustained price control across many blocks. Also uses `OracleAccessor` for adaptive fee adjustments.

### fbyt

```rust
pub const SOL_USD_FEED_ID: &str = "0xef0d8b6fda2..."; // Always SOL/USD
```

Three critical issues:
1. Wrong price for any non-SOL trade
2. No confidence interval rejection
3. No feed ID → mint verification

### Recommended Architecture

```rust
// In VaultState:
pub price_feeds: [(Pubkey, [u8; 32]); 5], // (mint_pubkey, pyth_feed_id) pairs

// In execute_trade_pyth handler:
let expected_feed = vault.get_feed_for_mint(vault_input_mint.key())?;
require!(price_update.feed_id == expected_feed, VaultError::InvalidPriceFeedForMint);
require!(price.conf * 100 <= price.price.unsigned_abs(), VaultError::PriceConfidenceTooWide);
let amount_out = calculate_amount_out(
    amount_in, price.price, price.expo,
    ctx.accounts.vault_input_mint.decimals,
    ctx.accounts.vault_output_mint.decimals,
)?;
```

---

## 8. Token Handling & CPI Safety

### Whirlpools

- Strict named CPI wrappers: `transfer_from_owner_to_vault`, `transfer_from_vault_to_owner`, `burn_and_close_user_position_token`
- Transfer memos on every CPI: `"Orca Trade"`, `"Orca Withdraw"`, `"Orca CollectFees"`
- Token-2022 aware: parallel `_with_transfer_fee_extension` variants

### fbyt Gaps

1. No transfer memos — transfers invisible in indexers
2. No Token-2022 extension support
3. Inline CPI in handler bodies — hard to audit
4. No vault deposit token account verification on withdrawal — `withdraw_mint` only checked against accounts, not enforced as `vault.deposit_mint`

### Recommendation

Create `src/util/token.rs`:
```rust
pub fn transfer_investor_to_vault(ctx, amount, decimals) -> Result<()>;
pub fn transfer_vault_to_investor(ctx, amount, decimals, signer_seeds) -> Result<()>;
pub fn mint_shares(ctx, amount, signer_seeds) -> Result<()>;
pub fn burn_shares(ctx, amount) -> Result<()>;
```

Add `constants/transfer_memo.rs`:
```rust
pub const MEMO_DEPOSIT: &str = "FBYT Deposit";
pub const MEMO_WITHDRAW: &str = "FBYT Withdraw";
pub const MEMO_TRADE: &str = "FBYT Trade";
```

---

## 9. Authority & Role Management

### Whirlpools

- Static admin keys compiled into binary via Cargo features (`#[cfg(feature = "mainnet")]`)
- Multi-role config: `fee_authority`, `collect_protocol_fees_authority`, `reward_emissions_super_authority`
- Feature flags: `ConfigFeatureFlags` bitflags for on-chain protocol toggles

### fbyt Gaps

| Feature | Whirlpools | fbyt | Risk |
|---|---|---|---|
| Manager key rotation | `set_fee_authority` instruction | None | High — key loss = vault frozen |
| Multi-role separation | 3+ roles | Single manager | Medium |
| Feature toggles | Bitflag config account | None | Medium |

### Recommendations

```rust
// Two-step manager transfer (prevents accidental transfer)
pub fn set_pending_manager(ctx: Context<SetPendingManager>, new_manager: Pubkey) -> Result<()>;
pub fn accept_manager(ctx: Context<AcceptManager>) -> Result<()>;

// Allowed mints update (currently immutable post-init)
pub fn update_allowed_mints(ctx: Context<UpdateAllowedMints>, new_mints: [Pubkey; 4]) -> Result<()>;
```

---

## 10. Event System

### Whirlpools Events Include

- Pre AND post state (e.g. `pre_sqrt_price` + `post_sqrt_price` in `Traded`)
- Fee breakdown per event (LP fee vs protocol fee vs transfer fee)
- Indexer-complete — enough data to reconstruct full state history without reading accounts

### fbyt Events — Missing Fields

```rust
// Add to Deposited:
nav_per_share: u64,          // NAV at time of deposit for auditing
total_assets_after: u64,
total_shares_after: u64,

// Add to Withdrawn:
nav_per_share: u64,
performance_fee_taken: u64,

// Add to TradeExecuted:
price_confidence: u64,       // pyth conf interval
slippage_bps: u64,           // actual vs expected
vault_assets_after: u64,

// Missing events entirely:
VaultActivated { vault, manager, total_raised, timestamp }
VaultPaused { vault, manager, reason, timestamp }
FeesCollected { vault, manager, performance_fee, management_fee, timestamp }
ManagerChanged { vault, old_manager, new_manager, timestamp }
AllowedMintsUpdated { vault, manager, old_mints, new_mints }
```

---

## 11. Testing Strategy

### What Whirlpools Does

| Approach | Detail |
|---|---|
| Data-driven fixtures | `swap_test_cases.json` (2.5MB) + `swap_test_cases_splash_pool.json` (1.9MB) = 6,720 test vectors |
| Off-chain math tests | `SwapTestFixture` runs core math without SVM context — fast, exhaustive |
| Full permutation coverage | Fee rate × tick position × liquidity × trade direction × exact input/output |
| Specific arithmetic edge cases | `MultiplicationShiftRightOverflow`, `SqrtPriceOutOfBounds`, `AmountRemainingOverflow` explicitly tested |
| Integration tests | Full instruction paths via LiteSVM |

### What fbyt Has: 6 Tests

### Critical Missing Tests

```rust
// SECURITY: share_token_mint spoofing
fn test_deposit_rejects_wrong_share_mint()

// SECURITY: unauthorized manager trade
fn test_trade_rejects_non_manager()

// ACCOUNTING: share dilution correctness
fn test_second_deposit_share_ratio_correct()

// ACCOUNTING: withdraw all shares then deposit
fn test_withdraw_all_shares_then_deposit()

// MATH: price calculation edge cases
fn test_calculate_amount_out_negative_expo()
fn test_calculate_amount_out_positive_expo()
fn test_calculate_amount_out_overflow()

// STATE MACHINE: invalid transitions
fn test_cannot_activate_twice()
fn test_cannot_deposit_to_dormant_vault()
fn test_cannot_trade_in_fundraising_status()

// LOCKUP: exact boundary conditions
fn test_withdraw_exactly_at_lockup_boundary()    // must SUCCEED (>= not >)
fn test_withdraw_one_second_before_lockup()      // must FAIL

// ORACLE: confidence rejection
fn test_trade_rejects_wide_confidence_interval()

// FEES: accrual correctness (once implemented)
fn test_management_fee_accrual_over_time()
fn test_performance_fee_on_profit()
fn test_no_performance_fee_below_high_water_mark()
```

### Math Property Tests (invariant-based)

```
Property: shares_to_mint * total_assets / total_shares <= deposited (no free money)
Property: amount_out * total_shares / total_assets <= shares_burned
Property: after deposit + identical withdraw, total_assets <= initial
```

---

## 12. Infrastructure & Developer Experience

| Feature | Whirlpools | fbyt | Notes |
|---|---|---|---|
| `security.txt` in binary | Yes | No | Bug bounty & whitehat contacts |
| `CHANGELOG.md` per program | Yes | No | Version history for auditors |
| `.audits/` directory | Yes | No | Published audit reports |
| Docker compose for local env | Yes | No | Pyth + Validator reproducibility |
| Transfer memo strings | Yes | No | Indexer traceability |
| Cargo feature flags | Yes | No | mainnet vs devnet constants |
| IDL published/verified | Yes | No | Client SDK generation |

### Add `security.txt`

```rust
// src/security.rs
#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "fbyt-clone-vault",
    project_url: "https://github.com/your-org/fbyt-clone-1",
    contacts: "discord: your-discord",
    policy: "Responsible disclosure to team before public reporting",
    source_code: "https://github.com/your-org/fbyt-clone-1/tree/main/contracts"
}
```

---

## 13. Prioritized Action Items

### 🔴 Critical (Fix Before Any Public Deployment)

| # | Issue | File | Action |
|---|---|---|---|
| C-1 | `share_token_mint` not stored on `VaultState` | `state.rs`, `deposit.rs`, `withdraw.rs` | Add `share_token_mint: Pubkey`; validate in deposit/withdraw |
| C-2 | Synthetic burn/mint trade simulation | `execute_trade_pyth.rs` | Replace with real DEX CPI (Jupiter, Orca) |
| C-3 | Decimal mismatch in price calculation | `pyth_price.rs` | Add `input_decimals`/`output_decimals` parameters |
| C-4 | Hardcoded SOL/USD feed ID | `pyth_price.rs`, `state.rs` | Store mint→feed map on VaultState; validate at runtime |

### 🟠 High (Fix for Portfolio Quality)

| # | Issue | File | Action |
|---|---|---|---|
| H-1 | Pyth confidence interval ignored | `pyth_price.rs` | Add `conf/price > 1%` rejection |
| H-2 | Lockup is global, not per-investor | `withdraw.rs`, `state.rs` | Add `InvestorPosition` PDA |
| H-3 | Fee system non-functional | `state.rs`, new files | Implement `high_water_mark`, fee accrual, `collect_fees` |
| H-4 | No manager rotation instruction | new file | Add `set_pending_manager` + `accept_manager` |
| H-5 | Single `MathOverflow` error | `errors.rs` | Granular math errors |

### 🟡 Medium (Architecture Quality)

| # | Issue | Action |
|---|---|---|
| M-1 | Logic mixed into handlers | Extract `src/manager/` layer |
| M-2 | No `_reserved` padding in state | Add `[u8; 64]` reserved bytes to `VaultState` |
| M-3 | No emergency pause | Add `is_paused: bool` + `pause_vault` instruction |
| M-4 | No Token-2022 support | Add parallel `_with_transfer_fee` CPI paths |
| M-5 | No transfer memos | Add `spl_memo` CPI to all transfers |
| M-6 | Missing event fields | Add pre/post state, NAV, fee breakdown |

### 🟢 Low (Polish & DX)

| # | Issue | Action |
|---|---|---|
| L-1 | No `security.txt` | Add `solana_security_txt` |
| L-2 | No dedicated math module | Extract `src/math/share_math.rs`, `fee_math.rs` |
| L-3 | No Cargo feature flags | Add `mainnet`/`devnet` features |
| L-4 | No `CHANGELOG.md` | Document version history |
| L-5 | Only 6 tests | Expand to 30+ covering all edge cases above |
| L-6 | No `.audits/` directory | Prepare for external audit, track findings |
