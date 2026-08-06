# FBYT Clone Vault — Program Audit & Adjustment Report
**Audit Date:** 2026-08-06  
**Auditor role:** Lead Solana/Anchor Engineer  
**Scope:** `contracts/programs/fbyt-clone-vault` — all source files, tests, and build config  
**Verdict summary:** Solid POC foundation, several critical security gaps, meaningful architectural debt. Not enterprise-grade yet.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Critical Security Issues](#2-critical-security-issues)
3. [High Severity — Logic Bugs](#3-high-severity--logic-bugs)
4. [Medium Severity — Architecture & Design](#4-medium-severity--architecture--design)
5. [Low Severity — Code Quality](#5-low-severity--code-quality)
6. [Optimization](#6-optimization)
7. [Test Coverage](#7-test-coverage)
8. [What Is Good](#8-what-is-good)
9. [Roadmap to Enterprise Grade](#9-roadmap-to-enterprise-grade)

---

## 1. Executive Summary

| Category | Count | Worst Impact |
|---|---|---|
| Critical Security | 5 | Total fund drain |
| High (Logic Bugs) | 6 | State corruption / broken math |
| Medium (Architecture) | 7 | Scalability / maintainability wall |
| Low (Code Quality) | 8 | Tech debt |
| Optimization | 5 | Excess compute / rent cost |
| Test gaps | 7 | Undetected regressions |

The **core deposit/withdraw share math is correct** (u128 overflow-safe, first-deposit 1:1, proportional thereafter). The Pyth oracle integration is correct. The event emission is well-designed. The Anchor 1.0 idioms (`token_interface`, `InitSpace`, bumps via `ctx.bumps`) are used properly.

However, the program has **5 critical issues** that would allow fund theft or permanent vault locking on mainnet. It also contains orphaned draft files that cannot compile. It is **not ready for mainnet** but is a good POC to put on a portfolio with the caveats below clearly addressed.

---

## 2. Critical Security Issues — Must Fix Before Mainnet

### C-1 · `execute_trade_pyth` burns and mints against any mint — no asset allowlist

**File:** `src/instructions/execute_trade_pyth.rs` lines 33-50

```rust
// vault_input_mint and vault_output_mint are completely unconstrained
#[account(mut)]
pub vault_input_mint: InterfaceAccount<'info, Mint>,
#[account(mut)]
pub vault_output_mint: InterfaceAccount<'info, Mint>,
```

The manager can pass **any** mint account as `vault_input_mint` or `vault_output_mint`. There is zero validation that these mints belong to the vault's sanctioned asset list. A malicious or compromised manager can burn the real deposit token and mint worthless tokens to the vault's output account, instantly draining investor value.

**Fix:** Maintain a whitelist of approved mints in `VaultState` (e.g. `allowed_mints: [Pubkey; 4]`) and add a `constraint` that both mints are in that list. Alternatively, verify that `vault_input_token_account.mint` matches the configured base-asset mint stored on the vault.

---

### C-2 · `execute_trade_pyth` simulates a trade via burn/mint — not a real swap

**File:** `src/instructions/execute_trade_pyth.rs` lines 75-97

The instruction burns tokens from one account and mints tokens to another using the **vault_authority PDA as mint authority**. This only works if the program itself is the issuer of both tokens. Against real USDC or wSOL — which the program does not control — this will fail at the `burn` CPI. The vault is not the mint authority of USDC.

More dangerously: if the output mint IS controlled by the vault, the manager can mint unlimited tokens to themselves by fabricating a "trade."

**Fix:** Real trades must go through a DEX CPI (Jupiter, Orca, Raydium). `execute_trade_pyth` should use the Pyth price **only for slippage validation**, not as the oracle to calculate synthetic output amounts.

---

### C-3 · `withdraw-fresh.rs` uses `checked_min` instead of `checked_sub` — corrupts vault shares

**File:** `src/instructions/withdraw-fresh.rs` lines 114-116

```rust
// BUG: checked_min returns the SMALLER of the two values, not a subtraction
vault.total_shares_minted = vault.total_shares_minted
    .checked_min(shares_to_burn)   // WRONG — this is min(), not sub()
    .ok_or(crate::errors::VaultError::MathOverflow)?;
```

After a withdrawal, `total_shares_minted` is set to `min(current_shares, shares_to_burn)` — completely wrong. Every subsequent depositor and withdrawer gets wrong NAV.

**Fix:**
```rust
vault.total_shares_minted = vault.total_shares_minted
    .checked_sub(shares_to_burn)
    .ok_or(crate::errors::VaultError::MathOverflow)?;
```

---

### C-4 · `withdraw-me.rs` references `vault.key` instead of `vault.key()` — PDA derivation breaks

**File:** `src/instructions/withdraw-me.rs` lines 28-29 and line 80

```rust
seeds = [VAULT_AUTHORITY_SEED, vault.key.as_ref()],   // .key is wrong, needs .key()
vault.key.as_ref(),   // same bug in signer_seeds construction
```

`vault.key` is the raw field on the underlying `AccountInfo` (not stable API). The correct call is `vault.key()`. The seeds will be computed from a different value — allowing an attacker to supply a spoofed authority account.

**Fix:** Replace all `vault.key` with `vault.key()` consistently.

---

### C-5 · `withdraw-fresh.rs` missing `VaultStatusCode::Dormant` lockout check

**File:** `src/instructions/withdraw-fresh.rs` lines 18-23

The vault account constraint has no `status` check. The canonical `withdraw.rs` correctly gates on `vault.status != VaultStatusCode::Dormant`. A Dormant vault should have special withdrawal logic. Silently allowing or silently blocking withdrawals in Dormant state is undefined behavior.

---

## 3. High Severity — Logic Bugs

### H-1 · Share math: accounting value != actual on-chain balance

**File:** `src/instructions/withdraw.rs` lines 80-84

`total_assets_deposited` is the accounting value, not the actual token balance of the vault token account. After trades or fee deductions, these diverge. The `amount_out <= vault.total_assets_deposited` check only guards against the accounting value, not the real on-chain balance.

**Fix:** Add `require!(vault_token_account.amount >= amount_out, ...)` against the actual vault token account balance before executing the transfer.

---

### H-2 · `min_raise_amount` stored but vault status never transitions — trading permanently blocked

**Files:** `src/instructions/initialize_vault.rs`, `src/instructions/deposit.rs`

`min_raise_amount` is stored in vault state but no instruction transitions the vault from `Fundraising` → `Active` when the threshold is met. `execute_trade_pyth` requires `status == Active`, meaning the manager can never trade. The vault is forever stuck in `Fundraising`.

**Fix:** Add an `activate_vault` instruction callable by the manager once `total_assets_deposited >= min_raise_amount`, OR auto-transition inside `deposit` when the threshold is crossed.

---

### H-3 · `execute_trade_pyth` does not update `total_assets_deposited` after trade

**File:** `src/instructions/execute_trade_pyth.rs` line 99

After burning `amount_in` input tokens and minting `amount_out` output tokens, `total_assets_deposited` is NOT updated. Share NAV calculations use stale accounting. If `amount_out != amount_in`, the accounting is permanently wrong and downstream `amount_out` in `withdraw.rs` will overflow or under-deliver.

**Fix:** Update `vault.total_assets_deposited` to reflect the net value change after trade.

---

### H-4 · `calculate_amount_out` lossy cast from u128 to u64

**File:** `src/pyth_price.rs` lines 33-44

```rust
.map(|v| v as u64)   // silent truncation if v > u64::MAX
```

The intermediate calculation uses `u128` correctly, but the final cast to `u64` is unchecked. Large SOL amounts at high prices silently truncate instead of returning `MathOverflow`.

**Fix:**
```rust
.and_then(|v| u64::try_from(v).ok())
.ok_or(crate::errors::VaultError::MathOverflow)?
```

---

### H-5 · `deposit.rs` CPI uses `.key()` instead of `.to_account_info()`

**File:** `src/instructions/deposit.rs` line 90

```rust
let cpi_ctx = CpiContext::new(ctx.accounts.token_program.key(), transfer_accounts);
//                                                         ^^^^^ .key() returns Pubkey, not AccountInfo
```

`CpiContext::new` takes `AccountInfo`, not `Pubkey`. This is a compile error. Same pattern appears in `execute_trade_pyth.rs` lines 81 and 92.

**Fix:**
```rust
let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);
```

---

### H-6 · `withdraw-me.rs` burns shares BEFORE computing `amount_out` — CEI violation

**File:** `src/instructions/withdraw-me.rs` lines 53-69

```rust
// Step 1: burn shares (irreversible)
burn(cpi_ctx, shares_to_burn)?;

// Step 2: THEN compute amount_out  ← too late, shares already burned
let amount_out = (shares_to_burn as u128) ...
```

Classic CEI (checks-effects-interactions) violation. If `amount_out` computation or subsequent transfer fails, shares are permanently burned with no compensation. Production `withdraw.rs` correctly computes `amount_out` before any CPIs.

---

## 4. Medium Severity — Architecture & Design

### M-1 · Five dead draft files cluttering src/instructions/ and breaking cargo check

The following files exist but are NOT registered in `mod.rs`:

| File | Status |
|---|---|
| `deposit-me.rs` | Draft / learning scratch with Indonesian comments |
| `deposit_my_vault.rs` | Draft / teaching example without events |
| `trade-fresh.rs` | Incomplete — has literal `_____BLANK_N_____` placeholders |
| `withdraw-fresh.rs` | Draft with critical bug (C-3) |
| `withdraw-me.rs` | Draft with critical bugs (C-4, H-6) |

These are unimportable as Rust modules (kebab-case filenames). `trade-fresh.rs` would fail instantly if compiled.

**Fix:** Delete all five files or move them to a `drafts/` directory outside `src/`.

---

### M-2 · Events declared in `initialize_vault.rs` — wrong architectural placement

`Deposited`, `Withdrawn`, and `TradeExecuted` events are declared inside `initialize_vault.rs` even though they have nothing to do with vault initialization. Every instruction must import from `initialize_vault` to get events — a backwards dependency.

**Fix:** Create `src/events.rs` with all `#[event]` structs. Each instruction imports from `crate::events::*`.

---

### M-3 · `VaultState` defined in `initialize_vault.rs`, not in `state.rs`

`state.rs` is only a re-export shim (2 lines). `VaultState` and `VaultStatusCode` should be **defined** in `state.rs` and imported into `initialize_vault.rs`. Current pattern creates backwards dependencies across instruction modules.

---

### M-4 · No `activate_vault` / `pause_vault` status management instructions

There is no way to transition `Fundraising → Active`, `Active → Dormant`, or resume from `Dormant → Active`. Without this, `execute_trade_pyth` is permanently unusable.

---

### M-5 · Fee collection mechanism is declared but not implemented

`performance_fee_bps` and `management_fee_bps` are stored but no instruction ever deducts fees. A complete fee system needs a manager-owned fee token account, fee deduction on withdrawal (performance) or time interval (management), and accumulated fee tracking.

---

### M-6 · No single-asset enforcement — multi-token deposits break share NAV

`total_assets_deposited` is a single `u64` without denomination. If investors deposit USDC and wBTC, the share math collapses. The vault needs to enforce one accepted deposit mint.

**Fix:** Store `deposit_mint: Pubkey` in `VaultState`. Add constraint `deposit_mint.key() == vault.deposit_mint` in the deposit instruction.

---

### M-7 · `SHARE_TOKEN_NAME` and `SHARE_TOKEN_SYMBOL` constants are unused dead code

Defined in `constants.rs` but never used. Metaplex token metadata is never attached to the share token mint.

**Fix:** Integrate Metaplex Token Metadata on `initialize_vault` OR remove the unused constants.

---

## 5. Low Severity — Code Quality

### L-1 · Inconsistent file naming — kebab-case filenames in a Rust module tree

Rust modules cannot be kebab-case. `deposit-me.rs`, `trade-fresh.rs`, `withdraw-fresh.rs` are literally unimportable. This confirms they are scratch files.

### L-2 · Indonesian comments in source files

Comments like `// Dompet token punya investor`, `// investor nya itu sendiri` (from `deposit-me.rs`) are personal learning notes that have no place in portfolio code.

### L-3 · `rent: Sysvar<'info, Rent>` is unnecessary in Anchor 1.0

Since Solana runtime v1.9+, rent is collected automatically. Anchor 1.0 does not require passing the Rent sysvar. Appears in `initialize_vault.rs` and `deposit.rs`. Remove it.

### L-4 · Placeholder program ID in production

```rust
declare_id!("FBYT1111111111111111111111111111111111111");
```

Must match the actual deployed keypair. Run `solana-keygen new -o target/deploy/fbyt_clone_vault-keypair.json` and update before any devnet deploy.

### L-5 · `plan.md` references stale dependency version

`plan.md` documents `pyth-solana-receiver-sdk = "0.7.0"` but `Cargo.toml` pins `2.0.0`. Documentation is stale.

### L-6 · `TradeExecuted` event emits `feed_id` as `String` — expensive

```rust
pub feed_id: String,   // ~64 bytes of heap allocation per event
```

Pyth feed IDs are 32-byte arrays. Use `[u8; 32]` or `Pubkey` instead of `String`.

### L-7 · `deposit_my_vault.rs` uses auto-derive `bump` instead of stored `vault.vault_bump`

```rust
seeds = [b"vault", vault.manager.as_ref()],
bump,   // auto-derives bump each time — 1 extra find_program_address syscall
```

Production `deposit.rs` correctly uses `bump = vault.vault_bump`. The draft file regresses on this optimization.

### L-8 · `setup_svm` function duplicated across both test files

`integration.rs` and `test_fbyt_clone_vault.rs` each define an almost identical `setup_svm`. Extract to `tests/common/mod.rs`.

---

## 6. Optimization

### O-1 · `lto = "fat"` and `codegen-units = 1` — correctly set ✅

This is the correct production profile for Solana programs. Full LTO reduces binary size and enables cross-crate inlining. Well done.

### O-2 · `VaultState` field ordering is not pack-optimal

`u16` fields sit between larger types causing borsh padding waste. Reorder: group `i64/u64` fields together, then `u16`, then `u8`. Saves a few bytes of account rent per vault.

> ⚠️ Breaking serialization change — only safe before first deployment.

### O-3 · PDA seed construction duplicated in every handler

The same 3-element seed array is hand-crafted in 4 handlers:
```rust
let seeds = &[VAULT_AUTHORITY_SEED, vault.key().as_ref(), &[vault.vault_authority_bump]];
```
Extract to a shared `utils.rs` helper to reduce duplication and bug surface.

### O-4 · `Clock::get()?` called before it's needed in some handlers

Cache the result. As the program grows and instructions call `Clock::get()` multiple times, each call is a syscall.

### O-5 · Token-2022 test program ID is correct but spl-token builders may be wrong

`TOKEN_PROGRAM_ID = TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` is Token-2022. The tests call classic `spl-token` instruction builders (`token_ix::initialize_mint2`, `token_ix::mint_to`). Verify these builders are compatible with Token-2022 account layout. They may silently fail or produce wrong account data in some configurations.

---

## 7. Test Coverage

### T-1 · `test_deposit_and_withdraw` is happy-path only

Does not verify: zero-share withdrawal edge case, proportional math across multiple depositors, fee boundary cases.

### T-2 · No lockup period enforcement test

`plan.md` planned "Withdrawal before lockup — expect LockupActive error." Not implemented.

### T-3 · No unauthorized manager test

No test verifies that a non-manager wallet calling `execute_trade_pyth` is rejected.

### T-4 · No fee cap validation test

No test verifies `performance_fee + management_fee > 10000` is rejected with `FeeTooHigh`.

### T-5 · Vault token account balance not asserted after deposit/withdraw

Test only checks `VaultState` accounting fields. Actual on-chain token balances should also be verified.

### T-6 · No Pyth oracle mock test

`execute_trade_pyth` is entirely untested. A mock `PriceUpdateV2` account must be crafted and loaded into LiteSVM.

### T-7 · `setup_svm` duplicated across test files

Should be extracted to a shared test helper module.

---

## 8. What Is Good

| Strength | Detail |
|---|---|
| ✅ Checked arithmetic everywhere | All math uses `checked_mul`, `checked_div`, `checked_add`, `checked_sub` |
| ✅ u128 intermediate calculations | No overflow on share math even at large values |
| ✅ PDA bump stored in state | Avoids re-derivation syscall on every CPI — correct Anchor optimization |
| ✅ Anchor 1.0 token_interface | Future-proofed for Token-2022 compatibility |
| ✅ Rich event emission | All 4 instructions emit typed events — well-structured for backend indexing |
| ✅ `InitSpace` derived | Correct `space` calculation on vault account init |
| ✅ Pyth staleness check | `get_price_no_older_than` with 60s age limit — correct API usage |
| ✅ Fee cap validation | `performance + management <= 10000 bps` checked on init |
| ✅ Fat LTO profile | `lto = "fat"`, `codegen-units = 1`, `overflow-checks = true` |
| ✅ LiteSVM test framework | Modern, fast, no validator needed — correct choice |
| ✅ Proportional share pricing | First-deposit 1:1, subsequent proportional — standard vault math |

---

## 9. Roadmap to Enterprise Grade

```
Phase 1 — Make it correct (1-2 weeks)
├── Delete all 5 draft/orphan files (deposit-me, deposit_my_vault, trade-fresh, withdraw-fresh, withdraw-me)
├── Fix H-5: .key() → .to_account_info() in all CPI contexts
├── Fix H-4: unchecked u64 cast → checked try_from in calculate_amount_out
├── Fix C-3: checked_min → checked_sub (withdraw-fresh before promoting)
├── Fix C-4: vault.key → vault.key() (withdraw-me before promoting)
├── Add activate_vault instruction (fix H-2: status forever Fundraising)
├── Fix C-1: add allowed_mints whitelist to VaultState
└── Fix H-3: update total_assets_deposited after trade

Phase 2 — Architecture cleanup (1 week)
├── Move events to src/events.rs
├── Move VaultState/VaultStatusCode definition to src/state.rs
├── Remove Rent sysvar from all account structs
├── Extract vault_authority_seeds() helper
├── Attach Metaplex token metadata to share mint OR remove unused name/symbol constants
└── Add deposit_mint: Pubkey to VaultState — enforce single-asset constraint

Phase 3 — Real trading (2-3 weeks)
├── Replace burn/mint simulation with Jupiter CPI or Orca CPI
├── Use Pyth price for slippage validation only (not synthetic output)
└── Implement fee collection: performance fee on profitable withdrawals, management fee on time interval

Phase 4 — Security hardening
├── Add pause_vault / emergency_withdraw for governance
├── Add multi-sig manager authority (Squads or custom threshold)
├── Add vault capacity ceiling (max_total_assets)
└── Commission Halborn or Soteria audit before mainnet

Phase 5 — Test coverage to 90%+
├── Lockup enforcement tests (before/after lockup)
├── Unauthorized manager tests
├── Fee boundary tests (0 bps, 10000 bps, 10001 bps)
├── Multi-depositor proportional math tests
├── Vault balance vs accounting divergence tests
└── Pyth mock oracle trade tests
```

---

## Final Verdict

**For a POC / portfolio piece:** This is a credible demonstration of Anchor 1.0 concepts, Pyth oracle integration, share token mechanics, and Solana PDA patterns. The math is correct in the core production path. The event system is well-thought-out. The LiteSVM test setup is modern.

**For production / mainnet:** Not ready. The 5 critical issues (C-1 through C-5) must be resolved, the burn/mint trade simulation is architecturally wrong, and the vault status machine is incomplete. A competent auditor would flag all of these immediately.

**Estimated effort to reach mainnet-ready MVP:** 4-6 weeks of focused engineering, followed by a professional audit.
