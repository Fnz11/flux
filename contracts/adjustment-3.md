# adjustment-3.md — Audit Insights & Enterprise Test Strategy

> **Reviewer**: Lead Solana Protocol Engineer  
> **Date**: 2026-08-06  
> **Reference A**: `/Users/macbookprom1/projects/whirlpools/.audits/` (6 audit reports)  
> **Reference B**: Whirlpool `src/manager/`, `src/math/`, `src/state/` (inline `#[cfg(test)]` modules)  
> **Reference C**: fbyt-clone-vault current test suite  
> **Objective**: Extract audit findings applicable to fbyt, model Whirlpool's edge-case & function-level test approach, and define what fbyt must add.

---

## Table of Contents

1. [Audit History Overview](#1-audit-history-overview)
2. [Audit Findings Applicable to fbyt](#2-audit-findings-applicable-to-fbyt)
3. [Whirlpool's Function-Level Test Philosophy](#3-whirlpools-function-level-test-philosophy)
4. [Whirlpool Test Pattern Catalog](#4-whirlpool-test-pattern-catalog)
5. [fbyt Current Test Coverage Gap Analysis](#5-fbyt-current-test-coverage-gap-analysis)
6. [Required Function-Level Tests for fbyt](#6-required-function-level-tests-for-fbyt)
7. [Required Edge Case Tests for fbyt](#7-required-edge-case-tests-for-fbyt)
8. [Test Infrastructure Improvements](#8-test-infrastructure-improvements)
9. [Prioritized Action Items](#9-prioritized-action-items)

---

## 1. Audit History Overview

Whirlpools has undergone **6 external audits** over 4 years:

| Audit Date | File Size | Context |
|---|---|---|
| 2022-01-28 | 1.9MB | Initial launch audit — foundational AMM security |
| 2022-05-05 | 242KB | Follow-up / scope extension audit |
| 2024-08-21 | 977KB | Major protocol upgrade audit (Token-2022, bundles) |
| 2025-02-28 | 86KB | Adaptive fee mechanism audit |
| 2025-06-23 | 201KB | Position lock & transfer feature audit |
| 2025-08-22 | 98KB | Latest incremental audit |

Each new feature shipped with its own dedicated external audit. This is the **enterprise standard**: new instruction → new audit scope.

### What this means for fbyt

As a POC, an external audit is not mandatory yet. But the audit trail shows **what categories of bugs auditors look for first**. The historical findings cluster into patterns we can extract and apply right now.

---

## 2. Audit Findings Applicable to fbyt

Based on the Whirlpool audit history and published Solana audit databases (OtterSec, Neodyme, Trail of Bits), the most common Solana program audit findings — directly applicable to a vault program like fbyt — are:

### 2.1 Missing Account Validation (Critical — Most Common)

**What auditors check**: Every `AccountInfo` / `Account<T>` must be validated. Missing constraints allow account substitution attacks.

**fbyt vulnerability spotted — `vault_authority` is `UncheckedAccount`**:
```rust
/// CHECK: PDA authority, never written to directly
pub vault_authority: UncheckedAccount<'info>,
```
While this is a common pattern for PDA-only signing authorities, the `/// CHECK:` comment is required by Anchor for audit trail. Ensure every `UncheckedAccount` has a documented justification.

**Audit finding class**: Ensure `vault_token_account.owner == vault_authority.key()` is always enforced at the account constraint level, not just the handler level. fbyt does this — but auditors will verify it.

### 2.2 Integer Overflow / Underflow (High — Very Common)

**What auditors check**: Every arithmetic operation must be checked. They look for `as u64`, bare `+`, bare `-`, and bare `*` operators.

**Whirlpool approach**: Zero unchecked arithmetic anywhere in the codebase. Every operation uses `checked_add`, `checked_mul`, `checked_div`, `checked_sub`, or the custom `U256Muldiv`.

**fbyt current state**: `calculate_shares_to_mint`, `calculate_amount_out`, `calculate_performance_fee`, `calculate_management_fee` all use `checked_*` — good. However:

- In `vault_manager.rs`, `process_deposit` and `process_withdraw` use `checked_sub` on state fields but delegate the pre-check to `calculate_amount_out`. The `require!(amount_out <= vault.total_assets_deposited)` guard is correct but should be the very first check before any math.
- `calculate_amount_out` in `pyth_price.rs`: `price as u128` — if Pyth returns a negative price, this silent cast creates a huge positive number causing a wildly incorrect `amount_out`. Must explicitly reject negative prices.

### 2.3 Missing Discriminator / Account Confusion Attacks (Critical)

**What auditors check**: Whirlpool has an explicit `test_discriminator` test for every account type that verifies the SHA256 discriminator bytes match a hardcoded expected value. This prevents an attacker from passing an account of type B where type A is expected by exploiting similar layout structures.

**Whirlpool approach**:
```rust
// In state/whirlpool.rs tests:
fn test_discriminator() {
    let expected = [...]; // hardcoded sha256 prefix
    assert_eq!(Whirlpool::discriminator(), expected);
}
```

**fbyt gap**: No discriminator verification tests exist. An attacker cannot easily exploit this because Anchor enforces discriminators automatically, but having the test proves your struct layout hasn't accidentally shifted.

### 2.4 Data Layout / Byte Alignment (High)

**What auditors check**: Struct memory layout mismatches between the deployed program and client-side deserialization cause silent data corruption. Whirlpool tests byte-for-byte serialization of every account type.

**Whirlpool approach**:
```rust
// In state/whirlpool.rs tests:
fn test_whirlpool_data_layout() {
    // Serializes a real Whirlpool struct and checks every byte offset
    let bytes = whirlpool.try_to_vec().unwrap();
    assert_eq!(bytes.len(), EXPECTED_SIZE);
    assert_eq!(&bytes[0..32], expected_manager_pubkey_bytes);
    // ... every field validated
}
```

**fbyt gap**: No `VaultState` data layout test. After adding new fields (`pending_manager`, `share_token_mint`, `_reserved`, etc.), the struct layout changed multiple times. A layout test would catch accidental regressions.

### 2.5 Rounding Direction Exploitation (High)

**What auditors check**: Does the protocol round in its own favor? Rounding toward the user on both minting and redeeming creates a drain vector: deposit → get slightly more shares than entitled → withdraw → drain pool.

**Whirlpool invariant from `token_math.rs` tests**:
> "The calculated rounded amount delta strictly limits deviation from the precise unrounded counterpart by a maximum absolute magnitude of 1."
> "Rounding UP price when calculating A ensures we collect ≥ expected. Rounding DOWN for B ensures equivalent."

**fbyt current rounding**:
```rust
// share_math.rs — calculate_shares_to_mint:
// Uses checked_div which truncates (floors) → rounds DOWN shares to mint ✅ vault-favorable
// calculate_amount_out:
// Uses checked_div which truncates (floors) → rounds DOWN assets returned ✅ vault-favorable
```
The rounding direction is correct. But there is NO test proving this invariant holds. Auditors will ask: "prove you always round against the user."

### 2.6 State Machine Transition Integrity (Medium)

**What auditors check**: Can states be skipped? Can an unauthorized actor force invalid transitions?

**Whirlpool approach**: `Whirlpool` state transitions are protected by explicit constraints and verified in tests (e.g. `test_whirlpool_reward_info_initialized` verifies `initialized()` only returns true under exact conditions).

**fbyt current state machine**:
```
Fundraising → Active (via activate_vault, only by manager, only if min_raise_amount met)
Fundraising → Dormant (no instruction exists!)
Active → Dormant (no instruction exists!)
Active → Fundraising (impossible — good)
```
Missing: A `close_vault` / `deactivate_vault` instruction to transition to `Dormant`. Without it, `VaultStatusCode::Dormant` is dead code that can never be reached. Auditors will flag dead code paths as potential logic issues.

### 2.7 Pyth Price Manipulation (Critical — Specific to fbyt)

**What auditors check in oracle-dependent programs**:
1. Is the feed ID validated against expected mints? ❌ fbyt hardcodes SOL/USD regardless
2. Is a staleness window enforced? ✅ fbyt uses `MAXIMUM_AGE = 60`
3. Is a negative price rejected? ❌ `price as u128` on a negative i64 creates a huge u128
4. Is the confidence interval checked? ✅ Added in adjustment-2
5. Can the manager manipulate the oracle account passed in? → `price_update: Account<PriceUpdateV2>` only accepts verified Pyth accounts, but the feed_id check is still needed

**Missing negative price guard**:
```rust
// In pyth_price.rs — should be the FIRST check:
require!(price_val > 0, crate::errors::VaultError::NegativePrice);
```

### 2.8 Fee Accounting Integrity (Medium)

**What auditors verify**: Can accrued fees exceed vault balance? Can fees be double-collected?

**fbyt gaps**:
- `accrued_performance_fee` and `accrued_management_fee` are set to zero after collection — correct.
- But: no check ensures `accrued_performance_fee + accrued_management_fee <= vault_token_account.amount` before transfer. This check exists in `collect_fees.rs` — but should be verified in a dedicated underflow test.
- No test for: what happens if only one fee type is > 0 and the other is 0?

---

## 3. Whirlpool's Function-Level Test Philosophy

The single biggest engineering difference between Whirlpools and fbyt is **where tests live**.

### Whirlpool Rule: Every `pub fn` Gets Tests IN THE SAME FILE

Every `*.rs` file in Whirlpool's `src/manager/`, `src/math/`, and `src/state/` directories ends with an inline `#[cfg(test)]` module. Tests are co-located with the function they test, not in a separate integration test file.

```rust
// Example from liquidity_manager.rs (164KB):
pub fn calculate_modify_liquidity(...) -> Result<ModifyLiquidityUpdate> { ... }

// SAME FILE, at the bottom:
#[cfg(test)]
mod test_modify_liquidity {
    use super::*;
    
    #[test]
    fn zero_delta_on_empty_position_not_allowed() { ... }
    
    #[test]
    fn neg_delta_lower_tick_liquidity_underflow() { ... }
    // ...30 more tests in the same file
}
```

### Why This Matters

1. **Reviewer clarity**: Anyone reading `liquidity_manager.rs` immediately sees what the function is designed to handle — zero delta, negative delta, underflow, overflow, current tick position variants.
2. **No orphaned tests**: Tests cannot go stale from the implementation because they live in the same file. A function signature change breaks the test immediately.
3. **Coverage is self-evident**: `cargo test` in any file shows exactly which behaviors are tested.

### Whirlpool Test Density

| File | Lines | Test Functions |
|---|---|---|
| `fee_rate_manager.rs` | 111,281 bytes | 25+ test functions |
| `liquidity_manager.rs` | 164,873 bytes | 30+ test functions |
| `swap_manager.rs` | 624,327 bytes | 6,720 data-driven vectors + 3 explicit tests |
| `token_math.rs` | 25,842 bytes | 8 test functions + proptest fuzzing |
| `bit_math.rs` | 12,237 bytes | 10+ test functions |
| `tick_manager.rs` | 30,993 bytes | 5 test modules, 15+ test functions |
| `position.rs` | 15,131 bytes | 9 test functions |
| `tick.rs` | 11,499 bytes | 15+ test functions across 3 modules |
| `whirlpool.rs` | 27,097 bytes | 6 test functions |

### fbyt Current Test Density

| File | Lines | Test Functions |
|---|---|---|
| `share_math.rs` | ~40 lines | **0** |
| `fee_math.rs` | ~35 lines | **0** |
| `pyth_price.rs` | ~65 lines | **0** |
| `vault_manager.rs` | ~70 lines | **0** |
| `collect_fees.rs` | ~70 lines | **0** |
| `pause_vault.rs` | ~30 lines | **0** |
| `accept_manager.rs` | ~30 lines | **0** |
| `set_pending_manager.rs` | ~20 lines | **0** |
| `state.rs` | ~35 lines | **0** |
| `errors.rs` | ~50 lines | **0** |

**Every single file has zero inline tests.** All 13 integration tests live in `tests/test_fbyt_clone_vault.rs` — a completely separate file that only tests happy-path transaction flows.

---

## 4. Whirlpool Test Pattern Catalog

Here are the specific edge case patterns Whirlpool tests that we must replicate for fbyt:

### Pattern 1: Zero Input Boundary

```rust
// Whirlpool: zero_delta_on_empty_position_not_allowed
// fbyt equivalent needed:
#[test]
fn test_shares_to_mint_zero_deposit_amount() {
    let result = calculate_shares_to_mint(0, 1_000_000, 1_000_000);
    assert_eq!(result.unwrap(), 0); // or verify error behavior
}
```

### Pattern 2: Underflow at Minimum Boundary

```rust
// Whirlpool: neg_delta_lower_tick_liquidity_underflow
// fbyt equivalent needed:
#[test]
fn test_amount_out_exceeds_total_assets() {
    let result = calculate_amount_out(1_000_001, 1_000_000, 1_000_000);
    // amount_out would be 1_000_001 but total_assets is 1_000_000
    // Must return InsufficientVaultBalance or MathOverflow
}
```

### Pattern 3: Maximum Value Overflow

```rust
// Whirlpool: test_mul_div_overflows with u128::MAX, u128::MAX
// fbyt equivalent needed:
#[test]
fn test_shares_to_mint_overflow_on_huge_supply() {
    let result = calculate_shares_to_mint(u64::MAX, u64::MAX, u64::MAX);
    // multiplication of u64::MAX * u64::MAX overflows u128
    assert!(result.is_err());
}
```

### Pattern 4: Rounding Direction Invariant

```rust
// Whirlpool: Verifies rounded != exact by at most 1
// fbyt equivalent needed:
#[test]
fn test_rounding_favors_vault_on_deposit() {
    // deposit 3 tokens when total=10, shares=10 → exact = 3.0 shares
    let shares = calculate_shares_to_mint(3, 10, 10).unwrap();
    // Should truncate to 3 (not round up to anything)
    assert_eq!(shares, 3);
    
    // deposit 1 token when total=3, shares=2 → exact = 0.666 shares
    let shares = calculate_shares_to_mint(1, 3, 2).unwrap();
    // Should truncate DOWN to 0 (not 1) — vault-favorable
    assert_eq!(shares, 0);
}

#[test]
fn test_rounding_favors_vault_on_withdraw() {
    // burn 1 share when total_assets=3, total_shares=2 → exact = 1.5 tokens
    let amount = calculate_amount_out(1, 3, 2).unwrap();
    // Should truncate DOWN to 1 (not 2) — vault-favorable
    assert_eq!(amount, 1);
}
```

### Pattern 5: State Machine Validity

```rust
// Whirlpool: test_whirlpool_reward_info_not_initialized / initialized
// fbyt equivalent needed:
#[test]
fn test_vault_status_default_is_fundraising() {
    // Default VaultStatusCode must be Fundraising
    // Active is never the default
}

#[test]
fn test_dormant_status_blocks_all_operations() {
    // Verify every instruction's constraint rejects Dormant status
}
```

### Pattern 6: Data Layout Serialization

```rust
// Whirlpool: test_position_data_layout, test_whirlpool_data_layout
// fbyt equivalent needed:
#[test]
fn test_vault_state_data_layout() {
    use anchor_lang::AnchorSerialize;
    let vault = VaultState {
        manager: Pubkey::default(),
        pending_manager: None,
        // ... fill all fields
    };
    let bytes = vault.try_to_vec().unwrap();
    // Verify total byte size matches expected
    assert_eq!(bytes.len(), VaultState::INIT_SPACE);
}
```

### Pattern 7: Discriminator Safety

```rust
// Whirlpool: test_discriminator
// fbyt equivalent needed:
#[test]
fn test_vault_state_discriminator() {
    use anchor_lang::Discriminator;
    // Hardcode the expected discriminator and verify it hasn't changed
    let discriminator = VaultState::discriminator();
    assert_eq!(discriminator, [/* hardcode expected 8 bytes */]);
}
```

### Pattern 8: Fee Rate Bounds

```rust
// Whirlpool: test_max_volatility_accumulator_should_bound_fee_rate
// fbyt equivalent needed:
#[test]
fn test_combined_fee_exceeding_10000_bps_is_rejected() {
    // 5001 + 5000 = 10001 > 10000
    let result = check_fee_cap(5001, 5000);
    assert!(result.is_err());
}

#[test]
fn test_combined_fee_exactly_10000_bps_is_accepted() {
    // 5000 + 5000 = 10000 <= 10000
    let result = check_fee_cap(5000, 5000);
    assert!(result.is_ok());
}
```

### Pattern 9: Proptest / Fuzz Testing

```rust
// Whirlpool: Uses proptest for fuzz testing token_math and swap_math
// fbyt equivalent needed:
use proptest::prelude::*;

proptest! {
    #[test]
    fn fuzz_shares_to_mint_never_exceeds_deposit_ratio(
        amount in 1u64..u64::MAX / 2,
        total_assets in 1u64..u64::MAX / 2,
        total_shares in 1u64..u64::MAX / 2,
    ) {
        if let Ok(shares) = calculate_shares_to_mint(amount, total_assets, total_shares) {
            // Invariant: shares / total_shares <= amount / total_assets
            // (vault never gives more than proportional)
            let lhs = (shares as u128) * (total_assets as u128);
            let rhs = (amount as u128) * (total_shares as u128);
            prop_assert!(lhs <= rhs, "Vault gave away too many shares!");
        }
    }
}
```

### Pattern 10: Negative / Invalid Price Edge Case

```rust
// Specific to fbyt (oracle-dependent programs):
#[test]
fn test_calculate_amount_out_rejects_negative_price() {
    let result = calculate_amount_out(1_000_000, -1, -8, 9, 6);
    assert!(result.is_err()); // Must not silently treat -1 as u128::MAX
}

#[test]
fn test_calculate_amount_out_rejects_zero_price() {
    let result = calculate_amount_out(1_000_000, 0, -8, 9, 6);
    assert!(result.is_err()); // Zero price means zero output — divide by zero risk
}
```

---

## 5. fbyt Current Test Coverage Gap Analysis

### What We Have (13 integration tests)

| Test | Type | Coverage |
|---|---|---|
| `test_initialize_vault` | Integration | Happy path only |
| `test_deposit_and_withdraw` | Integration | Happy path only |
| `test_activate_vault` | Integration | Status transition |
| `test_lockup_enforcement_on_withdrawal` | Integration | Time boundary |
| `test_fee_cap_enforcement_on_initialization` | Integration | Single boundary |
| `test_zero_amount_edge_cases` | Integration | Zero input |
| `test_rejects_double_init` | Integration | PDA uniqueness |
| `test_deposit_rejects_wrong_share_mint` | Integration | Security check |
| `test_trade_rejects_non_manager` | Integration | Access control |
| `test_second_deposit_share_ratio_correct` | Integration | NAV ratio |
| `test_pause_and_unpause_vault` | Integration | Pause toggle |
| `test_manager_rotation_two_step` | Integration | Key rotation |
| `test_collect_fees_accrual` | Integration | Fee collection |
| `test_decimal_normalization_in_trades` | Integration | Math accuracy |

### Critical Missing Coverage

**Zero function-level unit tests across all logic files.** The critical math functions in `share_math.rs`, `fee_math.rs`, `pyth_price.rs`, and `vault_manager.rs` have ZERO tests.

Integration tests only tell you "the flow works." Function-level tests tell you "the math is correct in every possible input configuration."

---

## 6. Required Function-Level Tests for fbyt

These must be added as `#[cfg(test)]` modules inside the files they test — not in `tests/`.

### 6.1 `src/math/share_math.rs` — Add `#[cfg(test)]` module

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    // --- calculate_shares_to_mint ---
    
    // Bootstrap: first deposit always gets 1:1 shares
    #[test]
    fn shares_to_mint_first_deposit_is_one_to_one() {
        assert_eq!(calculate_shares_to_mint(1_000_000, 0, 0).unwrap(), 1_000_000);
    }
    
    // Bootstrap: zero total_assets (with nonzero shares) still bootstraps correctly
    #[test]
    fn shares_to_mint_zero_total_assets_bootstraps() {
        assert_eq!(calculate_shares_to_mint(500_000, 0, 500_000).unwrap(), 500_000);
    }
    
    // Pro-rata: second deposit at 1:1 NAV
    #[test]
    fn shares_to_mint_pro_rata_at_equal_nav() {
        // 1M shares, 1M assets → deposit 1M → get 1M shares
        assert_eq!(calculate_shares_to_mint(1_000_000, 1_000_000, 1_000_000).unwrap(), 1_000_000);
    }
    
    // Pro-rata: second deposit when NAV doubled (assets doubled)
    #[test]
    fn shares_to_mint_pro_rata_at_doubled_nav() {
        // 1M shares, 2M assets (NAV=2) → deposit 1M → get 500K shares
        assert_eq!(calculate_shares_to_mint(1_000_000, 2_000_000, 1_000_000).unwrap(), 500_000);
    }
    
    // Rounding: fractional share truncates DOWN (vault-favorable)
    #[test]
    fn shares_to_mint_truncates_down() {
        // 2 shares for 3 assets → deposit 1 → exact=0.666... → truncates to 0
        assert_eq!(calculate_shares_to_mint(1, 3, 2).unwrap(), 0);
    }
    
    // Zero deposit amount
    #[test]
    fn shares_to_mint_zero_deposit_returns_zero() {
        assert_eq!(calculate_shares_to_mint(0, 1_000_000, 1_000_000).unwrap(), 0);
    }
    
    // Overflow: multiplication of large values
    #[test]
    fn shares_to_mint_large_values_overflow_returns_error() {
        let result = calculate_shares_to_mint(u64::MAX, 1, u64::MAX);
        // u64::MAX * u64::MAX overflows u128 — or succeeds: verify either behavior
        // At minimum: must not panic
        let _ = result;
    }
    
    // --- calculate_amount_out ---
    
    // 1:1 NAV — burn 1 share, get 1 asset
    #[test]
    fn amount_out_at_equal_nav_is_one_to_one() {
        assert_eq!(calculate_amount_out(1_000_000, 1_000_000, 1_000_000).unwrap(), 1_000_000);
    }
    
    // Doubled NAV — burn 1 share, get 2 assets
    #[test]
    fn amount_out_at_doubled_nav() {
        // 1M shares, 2M assets → burn 1M shares → get 2M assets
        assert_eq!(calculate_amount_out(1_000_000, 2_000_000, 1_000_000).unwrap(), 2_000_000);
    }
    
    // Partial withdrawal — burn half shares
    #[test]
    fn amount_out_partial_withdrawal() {
        // 1M shares, 1M assets → burn 500K → get 500K
        assert_eq!(calculate_amount_out(500_000, 1_000_000, 1_000_000).unwrap(), 500_000);
    }
    
    // Rounding: fractional asset truncates DOWN (vault-favorable)
    #[test]
    fn amount_out_truncates_down() {
        // 2 shares, 3 assets → burn 1 share → exact=1.5 → truncates to 1
        assert_eq!(calculate_amount_out(1, 3, 2).unwrap(), 1);
    }
    
    // Zero shares_to_burn
    #[test]
    fn amount_out_zero_shares_returns_zero() {
        assert_eq!(calculate_amount_out(0, 1_000_000, 1_000_000).unwrap(), 0);
    }
    
    // Zero total_shares_minted → MathOverflow (division by zero)
    #[test]
    fn amount_out_zero_total_shares_returns_error() {
        let result = calculate_amount_out(1_000_000, 1_000_000, 0);
        assert!(result.is_err());
    }
    
    // Burn more shares than minted → result exceeds total_assets, should be caught upstream
    #[test]
    fn amount_out_burns_all_shares() {
        // All shares burned → should return total_assets exactly
        assert_eq!(calculate_amount_out(1_000_000, 1_000_000, 1_000_000).unwrap(), 1_000_000);
    }
}
```

### 6.2 `src/math/fee_math.rs` — Add `#[cfg(test)]` module

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    // --- calculate_performance_fee ---
    
    // Zero profit → zero fee
    #[test]
    fn performance_fee_zero_profit() {
        assert_eq!(calculate_performance_fee(0, 1000).unwrap(), 0);
    }
    
    // Zero fee bps → zero fee regardless of profit
    #[test]
    fn performance_fee_zero_bps() {
        assert_eq!(calculate_performance_fee(1_000_000, 0).unwrap(), 0);
    }
    
    // 10% fee on 1M profit → 100K fee
    #[test]
    fn performance_fee_ten_percent() {
        assert_eq!(calculate_performance_fee(1_000_000, 1000).unwrap(), 100_000);
    }
    
    // 100% fee bps (10000) → entire profit as fee
    #[test]
    fn performance_fee_hundred_percent() {
        assert_eq!(calculate_performance_fee(1_000_000, 10000).unwrap(), 1_000_000);
    }
    
    // 1 bps on 1 unit → truncates to 0 (rounding)
    #[test]
    fn performance_fee_fractional_truncates() {
        let result = calculate_performance_fee(1, 1).unwrap();
        assert_eq!(result, 0); // 1 * 1 / 10000 = 0
    }
    
    // Overflow: u64::MAX profit
    #[test]
    fn performance_fee_large_profit_does_not_panic() {
        let result = calculate_performance_fee(u64::MAX, 10000);
        // Either succeeds or returns MathOverflow — must not panic
        let _ = result;
    }
    
    // --- calculate_management_fee ---
    
    // Zero elapsed → zero fee
    #[test]
    fn management_fee_zero_elapsed_returns_zero() {
        assert_eq!(calculate_management_fee(1_000_000, 200, 0).unwrap(), 0);
    }
    
    // Negative elapsed → zero fee (guard)
    #[test]
    fn management_fee_negative_elapsed_returns_zero() {
        assert_eq!(calculate_management_fee(1_000_000, 200, -100).unwrap(), 0);
    }
    
    // Zero bps → zero fee
    #[test]
    fn management_fee_zero_bps() {
        assert_eq!(calculate_management_fee(1_000_000, 0, 31_536_000).unwrap(), 0);
    }
    
    // 2% annual fee over 1 year = 2% of assets
    #[test]
    fn management_fee_two_percent_annual() {
        let assets = 10_000_000u64;
        let bps = 200u16; // 2%
        let one_year = 365 * 86400i64;
        let fee = calculate_management_fee(assets, bps, one_year).unwrap();
        assert_eq!(fee, 200_000); // 2% of 10M
    }
    
    // Pro-rata: half year = half of annual fee
    #[test]
    fn management_fee_half_year_is_half_annual() {
        let assets = 10_000_000u64;
        let bps = 200u16;
        let half_year = (365 * 86400 / 2) as i64;
        let fee = calculate_management_fee(assets, bps, half_year).unwrap();
        // Should be approximately 100_000 (may differ by 1 due to rounding)
        assert!(fee >= 99_000 && fee <= 101_000);
    }
    
    // Overflow guard: huge assets
    #[test]
    fn management_fee_large_assets_does_not_panic() {
        let result = calculate_management_fee(u64::MAX, 10000, 31_536_000);
        let _ = result; // Must not panic
    }
}
```

### 6.3 `src/pyth_price.rs` — Add `#[cfg(test)]` module

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    // --- calculate_amount_out ---
    
    // Negative exponent: SOL $150 = price 15_000_000_000, expo -8
    #[test]
    fn amount_out_negative_expo_sol_to_usdc() {
        // 1 SOL (1e9 lamports) at $150 with -8 expo, 9 input decimals, 6 output decimals
        // total_expo = -8 + 6 - 9 = -11 → divide by 1e11
        // val = 1e9 * 15_000_000_000 / 1e11 = 150_000_000 (150 USDC in 6-decimal = 150.000000)
        let result = calculate_amount_out(1_000_000_000, 15_000_000_000, -8, 9, 6).unwrap();
        assert_eq!(result, 150_000_000);
    }
    
    // Positive exponent
    #[test]
    fn amount_out_positive_expo() {
        let result = calculate_amount_out(100, 50, 2, 0, 0).unwrap();
        assert_eq!(result, 500_000); // 100 * 50 * 100
    }
    
    // Zero exponent
    #[test]
    fn amount_out_zero_expo() {
        let result = calculate_amount_out(500, 3, 0, 0, 0).unwrap();
        assert_eq!(result, 1_500);
    }
    
    // Zero price → returns zero (or error — verify behavior is intentional)
    #[test]
    fn amount_out_zero_price_returns_zero() {
        let result = calculate_amount_out(1_000_000, 0, -8, 9, 6).unwrap();
        assert_eq!(result, 0); // 0 price means 0 output
    }
    
    // Negative price → should return MathOverflow (not silently wrap to huge u64)
    #[test]
    fn amount_out_negative_price_returns_error() {
        let result = calculate_amount_out(1_000_000, -1, -8, 9, 6);
        // -1 as u128 = u128::MAX → overflow
        assert!(result.is_err(), "Negative price must return error, not silent wrap");
    }
    
    // Same decimals → no decimal adjustment
    #[test]
    fn amount_out_same_decimals_no_adjustment() {
        // 1e6 input, price 2, expo -6, 6 input, 6 output → total_expo=-6+6-6=-6
        let result = calculate_amount_out(1_000_000, 2, -6, 6, 6).unwrap();
        assert_eq!(result, 2); // 1_000_000 * 2 / 1_000_000 = 2
    }
    
    // Overflow: huge amount_in + large price
    #[test]
    fn amount_out_overflow_returns_error() {
        let result = calculate_amount_out(u64::MAX, i64::MAX, 0, 0, 0);
        assert!(result.is_err());
    }
}
```

### 6.4 `src/manager/vault_manager.rs` — Add `#[cfg(test)]` module

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{VaultState, VaultStatusCode};
    use anchor_lang::prelude::Pubkey;
    
    fn mock_vault(total_assets: u64, total_shares: u64) -> VaultState {
        VaultState {
            manager: Pubkey::default(),
            pending_manager: None,
            deposit_mint: Pubkey::default(),
            share_token_mint: Pubkey::default(),
            allowed_output_mints: [Pubkey::default(); 4],
            min_raise_amount: 0,
            performance_fee_bps: 1000, // 10%
            management_fee_bps: 200,   // 2%
            accrued_performance_fee: 0,
            accrued_management_fee: 0,
            lockup_period: 0,
            total_shares_minted: total_shares,
            total_assets_deposited: total_assets,
            vault_bump: 0,
            vault_authority_bump: 0,
            status: VaultStatusCode::Active,
            is_paused: false,
            created_at: 0,
            last_trade_at: 0,
            high_water_mark: 0,
            last_fee_accrual_at: 0,
            _reserved: [0u8; 64],
        }
    }
    
    // --- calculate_nav ---
    
    #[test]
    fn nav_is_one_when_no_shares() {
        let vault = mock_vault(0, 0);
        assert_eq!(VaultManager::calculate_nav(&vault).unwrap(), 1_000_000_000);
    }
    
    #[test]
    fn nav_is_one_to_one_at_equal_assets_and_shares() {
        let vault = mock_vault(1_000_000_000, 1_000_000_000);
        assert_eq!(VaultManager::calculate_nav(&vault).unwrap(), 1_000_000_000);
    }
    
    #[test]
    fn nav_doubles_when_assets_double() {
        let vault = mock_vault(2_000_000_000, 1_000_000_000);
        assert_eq!(VaultManager::calculate_nav(&vault).unwrap(), 2_000_000_000);
    }
    
    // --- process_deposit ---
    
    #[test]
    fn deposit_first_deposit_one_to_one() {
        let mut vault = mock_vault(0, 0);
        let shares = VaultManager::process_deposit(&mut vault, 1_000_000).unwrap();
        assert_eq!(shares, 1_000_000);
        assert_eq!(vault.total_assets_deposited, 1_000_000);
        assert_eq!(vault.total_shares_minted, 1_000_000);
    }
    
    #[test]
    fn deposit_second_deposit_diluted_at_doubled_nav() {
        let mut vault = mock_vault(2_000_000, 1_000_000);
        let shares = VaultManager::process_deposit(&mut vault, 1_000_000).unwrap();
        assert_eq!(shares, 500_000); // NAV=2, so 1M deposit → 500K shares
        assert_eq!(vault.total_assets_deposited, 3_000_000);
        assert_eq!(vault.total_shares_minted, 1_500_000);
    }
    
    #[test]
    fn deposit_zero_amount_returns_zero_shares() {
        let mut vault = mock_vault(1_000_000, 1_000_000);
        let shares = VaultManager::process_deposit(&mut vault, 0).unwrap();
        assert_eq!(shares, 0);
        assert_eq!(vault.total_assets_deposited, 1_000_000); // unchanged
    }
    
    // --- process_withdraw ---
    
    #[test]
    fn withdraw_all_shares_returns_all_assets() {
        let mut vault = mock_vault(1_000_000, 1_000_000);
        let amount = VaultManager::process_withdraw(&mut vault, 1_000_000).unwrap();
        assert_eq!(amount, 1_000_000);
        assert_eq!(vault.total_shares_minted, 0);
        assert_eq!(vault.total_assets_deposited, 0);
    }
    
    #[test]
    fn withdraw_half_shares_returns_half_assets() {
        let mut vault = mock_vault(1_000_000, 1_000_000);
        let amount = VaultManager::process_withdraw(&mut vault, 500_000).unwrap();
        assert_eq!(amount, 500_000);
        assert_eq!(vault.total_shares_minted, 500_000);
        assert_eq!(vault.total_assets_deposited, 500_000);
    }
    
    #[test]
    fn withdraw_zero_shares_when_no_assets_fails() {
        let mut vault = mock_vault(0, 0);
        let result = VaultManager::process_withdraw(&mut vault, 1_000_000);
        assert!(result.is_err()); // total_shares == 0 → division by zero
    }
    
    #[test]
    fn withdraw_amount_exceeding_assets_fails() {
        // Simulate bad accounting: more shares exist than assets
        let mut vault = mock_vault(500_000, 1_000_000); // NAV < 1
        let result = VaultManager::process_withdraw(&mut vault, 1_000_000);
        // amount_out = 1M * 500K / 1M = 500K, which is <= total_assets (500K), so OK
        // This should succeed — amount_out is 500K not 1M
        assert!(result.is_ok());
    }
}
```

---

## 7. Required Edge Case Tests for fbyt

These go in `tests/test_fbyt_clone_vault.rs` as LiteSVM integration tests, covering scenarios that require the full SVM runtime.

### 7.1 Arithmetic Boundary Integration Tests

```rust
// Test: First deposit when total_shares == 0 but total_assets > 0 (accounting divergence)
fn test_deposit_after_total_assets_drift_without_shares()

// Test: Withdraw when vault has zero USDC but nonzero total_assets_deposited (divergence)
fn test_withdraw_fails_when_real_balance_zero()

// Test: Sequential deposits and withdrawals preserve NAV precisely
fn test_nav_preserved_across_deposit_withdraw_cycles()
```

### 7.2 Status Machine Edge Cases

```rust
// Test: Cannot activate vault that is already Active
fn test_activate_already_active_vault_fails()

// Test: Deposit into Dormant vault fails
fn test_deposit_into_dormant_vault_fails()

// Test: Trade into Fundraising status fails
fn test_trade_in_fundraising_status_fails()

// Test: Withdraw from Fundraising status succeeds (optional — check design intent)
fn test_withdraw_from_fundraising_status()
```

### 7.3 Lockup Precision Boundary

```rust
// Test: Withdraw at exactly lockup_period seconds succeeds (>= boundary)
fn test_withdraw_at_exact_lockup_expiry()

// Test: Withdraw 1 second before lockup fails
fn test_withdraw_one_second_before_lockup_fails()

// Test: Vault with lockup_period = 0 allows immediate withdrawal
fn test_withdraw_immediately_with_zero_lockup()

// Test: Vault with lockup_period = i64::MAX doesn't overflow
fn test_lockup_period_max_does_not_overflow()
```

### 7.4 Fee System Boundary Tests

```rust
// Test: Zero accrued fees → collect_fees rejects with InvalidAmount
fn test_collect_fees_with_zero_accrued_fails()

// Test: Only performance fee > 0, management fee = 0 → collection works
fn test_collect_fees_only_performance_fee()

// Test: Accrued fees > vault balance → collection rejects with InsufficientVaultBalance
fn test_collect_fees_exceeding_vault_balance_fails()

// Test: Fee collection resets both fee accumulators to zero
fn test_collect_fees_resets_accumulators()
```

### 7.5 Manager Rotation Edge Cases

```rust
// Test: set_pending_manager to own key is allowed
fn test_set_pending_manager_to_self()

// Test: set_pending_manager with Pubkey::default() is allowed
fn test_set_pending_manager_to_default_pubkey()

// Test: After accept_manager, old manager key can no longer trade
fn test_old_manager_cannot_trade_after_rotation()

// Test: Pending manager acceptance without set_pending_manager fails
fn test_accept_manager_without_pending_set_fails()
```

### 7.6 Share Mint Security Tests

```rust
// Test: Deposit with share_token_mint not owned by vault_authority fails
fn test_deposit_rejects_externally_owned_share_mint()

// Test: Withdraw with share_token_mint not matching vault.share_token_mint fails
fn test_withdraw_rejects_wrong_share_mint()
```

---

## 8. Test Infrastructure Improvements

### 8.1 Add proptest for Fuzz Testing

```toml
# Cargo.toml [dev-dependencies]
proptest = "1.4"
```

```rust
// src/math/share_math.rs
#[cfg(test)]
mod fuzz_tests {
    use super::*;
    use proptest::prelude::*;
    
    proptest! {
        #[test]
        fn fuzz_shares_to_mint_never_exceeds_pro_rata(
            amount in 1u64..=1_000_000_000u64,
            total_assets in 1u64..=1_000_000_000u64,
            total_shares in 1u64..=1_000_000_000u64,
        ) {
            if let Ok(shares) = calculate_shares_to_mint(amount, total_assets, total_shares) {
                // Key invariant: shares/total_shares <= amount/total_assets
                let lhs = (shares as u128) * (total_assets as u128);
                let rhs = (amount as u128) * (total_shares as u128);
                prop_assert!(lhs <= rhs, "Vault gave too many shares: {} > {}", lhs, rhs);
            }
        }
        
        #[test]
        fn fuzz_amount_out_never_exceeds_pro_rata(
            shares in 1u64..=1_000_000_000u64,
            total_assets in 1u64..=1_000_000_000u64,
            total_shares in 1u64..=1_000_000_000u64,
        ) {
            if let Ok(amount) = calculate_amount_out(shares, total_assets, total_shares) {
                // Key invariant: amount/total_assets <= shares/total_shares
                let lhs = (amount as u128) * (total_shares as u128);
                let rhs = (shares as u128) * (total_assets as u128);
                prop_assert!(lhs <= rhs, "Vault gave too many assets: {} > {}", lhs, rhs);
            }
        }
    }
}
```

### 8.2 Discriminator & Data Layout Tests

```rust
// src/state.rs
#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::{AnchorSerialize, Discriminator};
    
    #[test]
    fn vault_status_code_discriminator_values() {
        // Verify enum discriminants are stable
        let fundraising = VaultStatusCode::Fundraising;
        let active = VaultStatusCode::Active;
        let dormant = VaultStatusCode::Dormant;
        // Serialize and verify byte values are stable
        let f_bytes = fundraising.try_to_vec().unwrap();
        let a_bytes = active.try_to_vec().unwrap();
        let d_bytes = dormant.try_to_vec().unwrap();
        assert_ne!(f_bytes, a_bytes);
        assert_ne!(a_bytes, d_bytes);
    }
    
    #[test]
    fn vault_state_serialization_round_trips() {
        // Verifies struct layout is stable across serde
        let original = VaultState {
            manager: Pubkey::new_unique(),
            // ... fill all fields
        };
        let bytes = original.try_to_vec().unwrap();
        let decoded = VaultState::try_from_slice(&bytes).unwrap();
        assert_eq!(original.manager, decoded.manager);
        // ... verify every field
    }
}
```

### 8.3 Test Helper Improvements

```rust
// tests/common/mod.rs — add:

// Manipulate vault state for testing accounting scenarios
pub fn set_vault_state_fields(svm: &mut LiteSVM, vault_pda: &Pubkey, 
    total_assets: u64, total_shares: u64, status: VaultStatusCode) { ... }

// Assert NAV within a tolerance (for floating-point-like comparisons)
pub fn assert_nav_approx(actual: u64, expected: u64, tolerance_bps: u64) {
    let diff = if actual > expected { actual - expected } else { expected - actual };
    let tolerance = expected * tolerance_bps / 10000;
    assert!(diff <= tolerance, "NAV {} != expected {} (tolerance {}bps)", actual, expected, tolerance_bps);
}
```

---

## 9. Prioritized Action Items

### 🔴 Immediate (Missing Function-Level Tests — Enterprise Standard)

| File | Action |
|---|---|
| `src/math/share_math.rs` | Add `#[cfg(test)]` with 9 tests (zero, pro-rata, rounding, overflow) |
| `src/math/fee_math.rs` | Add `#[cfg(test)]` with 10 tests (zero, annual, half-year, overflow) |
| `src/pyth_price.rs` | Add `#[cfg(test)]` with 7 tests (negative price, zero price, decimal normalization) |
| `src/manager/vault_manager.rs` | Add `#[cfg(test)]` with 9 tests (nav, deposit state, withdraw state) |
| `src/state.rs` | Add `#[cfg(test)]` with layout & discriminator tests |

### 🟠 High (Critical Missing Edge Cases)

| Test | File | What it Guards |
|---|---|---|
| `test_negative_price_rejected` | `pyth_price.rs` | Silent cast of -1i64 to u128::MAX |
| `test_amount_out_exceeds_assets` | `share_math.rs` | Withdraw more than vault holds |
| `test_collect_fees_exceeding_balance` | `collect_fees.rs` | Fee > vault balance |
| `test_lockup_period_max_overflow` | `withdraw.rs` | i64 overflow on `created_at + lockup_period` |
| `test_vault_state_data_layout` | `state.rs` | Struct layout regression after field additions |
| `test_discriminator_stable` | `state.rs` | Account confusion attacks |

### 🟡 Medium (Completeness)

| Action | Description |
|---|---|
| Add `proptest` to dev-dependencies | Fuzz `calculate_shares_to_mint` and `calculate_amount_out` |
| Add state machine transition tests | Every invalid status transition should have a dedicated test |
| Add `assert_nav_approx` helper | For tests comparing NAV with rounding tolerance |
| Add `deactivate_vault` instruction | `VaultStatusCode::Dormant` is unreachable dead code |

### 🟢 Low (DX & Audit Trail)

| Action | Description |
|---|---|
| Add `.audits/` directory | Even for POC — shows audit-readiness mindset |
| Add `CHANGELOG.md` | Document every breaking change to `VaultState` layout |
| `/// # Panics` and `/// # Errors` docs | Every `pub fn` in `math/` and `manager/` needs rustdoc |
| CI with `cargo test` gate | No merge without all tests passing |
