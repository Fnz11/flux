# adjustment-4.md — fbyt-clone-vault Test Expansion Plan
## Target: 3,000+ Test Cases (from ~60)

**Inspired by**: Orca Whirlpools' 7,376-test architecture (654 inline unit tests + 6,720 data-driven vectors)
**Current state**: 59 inline `--lib` tests + a handful of integration test functions
**Goal**: Match the quality bar of an auditable, enterprise-grade Solana vault

---

## Why 3,000+ Tests?

Whirlpools' test philosophy:
1. Every pure function (math, state transitions) has its own inline test module with full boundary coverage
2. Data-driven matrix tests cover the N-dimensional parameter space — not 3,840 individual test functions, but ONE test runner that iterates over a JSON dataset of 3,840 vectors
3. Integration tests layer on top to validate full account-level flows

We follow the same architecture. The 3,000+ number comes from the JSON matrix approach applied to our three core math functions.

---

## Test Layer Architecture (3 Layers)

```
Layer 1: Inline Unit Tests (co-located)     ~160 new tests  (currently 59 → target 220)
Layer 2: Data-Driven JSON Matrix Tests      ~2,800 vectors  (currently 0 → target 2,800+)
Layer 3: Integration Tests                  ~75 new tests   (currently ~10 → target 90)
─────────────────────────────────────────────────────────────────
Total                                       ~3,100+ tests
```

---

## Layer 1: Inline Unit Tests (target: 220 tests)

### 1.1 src/math/share_math.rs (currently 14 → target 40)

#### calculate_shares_to_mint — add 13 new tests

| Test Name | deposit | assets | shares | Expected |
|-----------|---------|--------|--------|----------|
| nav_3x_one_third_shares | 1M | 3M | 1M | 333,333 |
| nav_10x_one_tenth_shares | 1M | 10M | 1M | 100,000 |
| min_deposit_1_wei_bootstrap | 1 | 0 | 0 | 1 |
| max_deposit_bootstrap | u64::MAX | 0 | 0 | u64::MAX |
| deposit_equal_to_total_assets | X | X | X | X |
| deposit_double_total_assets | 2X | X | X | 2X |
| deposit_half_total_assets | X/2 | X | X | X/2 |
| large_nav_small_deposit_truncates | 1 | u64::MAX/2 | 1 | 0 |
| total_shares_gt_assets_dilution | 1M | 500K | 2M | 4M (NAV=0.25) |
| share_mint_near_u64_max | u64::MAX/2 | 1 | 1 | Err(MathOverflow) |
| shares_exact_0_when_too_small | 1 | 1000 | 2000 | 2 |
| nav_0_5_double_shares | 1M | 500K | 1M | 2M |
| rounding_down_invariant | 1 | 3 | 2 | 0 (exact=0.666) |

#### calculate_amount_out — add 13 new tests

| Test Name | burn | assets | shares | Expected |
|-----------|------|--------|--------|----------|
| nav_3x_triple_assets_returned | 1M | 3M | 1M | 3M |
| burn_one_of_many_shares | 1 | 1M | 1M | 1 |
| burn_all_at_high_nav | shares | 5*shares | shares | 5*shares |
| tiny_shares_large_assets | 1 | u64::MAX | 2 | u64::MAX/2 |
| multiple_burns_drain_correctly | sequential | | | each pro-rata |
| single_wei_burn | 1 | 1B | 1B | 1 |
| burn_at_nav_0_5 | 1M | 500K | 1M | 500K |
| truncation_1_5_rounds_down | 1 | 3 | 2 | 1 |
| u64_max_all_fields | u64::MAX | u64::MAX | u64::MAX | u64::MAX |
| burn_quarter_shares | X/4 | X | X | X/4 |
| burn_three_quarter_shares | 3X/4 | X | X | 3X/4 |
| nav_100x_burn_1 | 1 | 100M | 1M | 100 |
| output_never_negative | various | | | always >= 0 |

### 1.2 src/math/fee_math.rs (currently 12 → target 30)

#### calculate_performance_fee — add 9 new tests

| Test Name | profit | bps | Expected |
|-----------|--------|-----|----------|
| five_percent_fee | 1M | 500 | 50,000 |
| one_bp_fee | 10_000 | 1 | 1 |
| max_fee_bps_9999 | 1M | 9999 | 999,900 |
| small_profit_large_bps | 99 | 10000 | 99 |
| profit_1_wei | 1 | 100 | 0 (rounds down) |
| profit_2M_is_2x_1M | 2M vs 1M | 1000 | 2x fee |
| fee_returns_exact_round | 10000 | 100 | 100 |
| large_profit_no_panic | u64::MAX | 1 | Ok |
| 25pct_fee | 1M | 2500 | 250,000 |

#### calculate_management_fee — add 9 new tests

| Test Name | assets | bps | elapsed | Expected |
|-----------|--------|-----|---------|----------|
| quarter_year_fee | 10M | 200 | 365*86400/4 | 50,000 |
| one_day_fee | 10M | 200 | 86400 | ~547 |
| one_second_fee | 10M | 200 | 1 | 0 (rounds) |
| max_assets_no_overflow | u64::MAX/1000 | 200 | 86400 | Ok |
| two_years_double_annual | 10M | 200 | 2*SECONDS_PER_YEAR | 2x annual |
| fee_scales_with_assets | 20M vs 10M | 200 | 1yr | 2x fee |
| fee_scales_with_bps | 10M | 400 vs 200 | 1yr | 2x fee |
| fee_100bps_is_1pct | 100M | 100 | 1yr | 1M |
| very_large_elapsed | 10M | 200 | 100 years | Ok or Err |

### 1.3 src/pyth_price.rs (currently 7 → target 30)

#### calculate_amount_out — add 23 new tests

| Test Name | amount_in | price | expo | in_dec | out_dec | Expected |
|-----------|-----------|-------|------|--------|---------|----------|
| sol_to_usdc_1_sol | 1e9 | 150*1e8 | -8 | 9 | 6 | 150_000_000 |
| sol_to_usdc_0_001_sol | 1e6 | 150*1e8 | -8 | 9 | 6 | 150_000 |
| btc_to_usdc | 1e8 | 60000*1e8 | -8 | 8 | 6 | 60_000_000_000 |
| usdc_to_sol | 150*1e6 | 150*1e8 (SOL) | -8 | 6 | 9 | 1_000_000_000 |
| same_token_price_1 | 1M | 1 | 0 | 6 | 6 | 1M |
| price_1_with_neg6_expo | 1M | 1 | -6 | 6 | 6 | 1 |
| high_price_large_amount | 1e9 | 1e9 | -9 | 0 | 0 | 1e9 |
| tiny_amount_rounds_zero | 1 | 1 | -10 | 0 | 0 | 0 |
| negative_expo_large_divisor | various | any | -18 | any | any | truncates |
| expo_negative_1 | X | P | -1 | same | same | X*P/10 |
| expo_positive_1 | X | P | 1 | same | same | X*P*10 |
| expo_0_no_scaling | X | P | 0 | same | same | X*P |
| input_dec_gt_output_dec | any | any | 0 | 9 | 6 | divide by 1e3 |
| output_dec_gt_input_dec | any | any | 0 | 6 | 9 | multiply by 1e3 |
| price_exactly_1 | X | 100 | -2 | 0 | 0 | X*1 |
| price_just_above_zero | X | 1 | -18 | 0 | 0 | near 0 |
| decimal_0_input_0_output | any | P | 0 | 0 | 0 | X*P |
| max_decimals_18_18 | 1M | 1M | 0 | 18 | 18 | 1M (same) |
| regression_sol_usdc_150 | 1e9 | 15_000_000_000 | -8 | 9 | 6 | 150_000_000 |
| regression_sol_usdc_cent | 1e9 | 150 | -2 | 9 | 6 | 150_000_000 (same) |
| overflow_max_price | u64::MAX | i64::MAX | 0 | 0 | 0 | Err |
| zero_price_error | any | 0 | any | any | any | Err(InvalidTradeParams) |
| negative_price_error | any | -1 | any | any | any | Err(InvalidTradeParams) |

### 1.4 src/manager/vault_manager.rs (currently 9 → target 40)

#### calculate_nav — add 8 tests
- nav_exact_10x: 10*shares assets → NAV = 10e9
- nav_with_fractional_assets: non-divisible → rounds down per share
- nav_overflow_guard: u64::MAX assets, 1 share → Err
- nav_100_shares_200_assets: exactly 2.0 NAV (2e9)
- nav_monotonically_increases_after_profit: simulate assets increasing
- nav_equals_1_after_bootstrap: first deposit → NAV = 1e9
- nav_at_0_5: half assets vs shares → NAV = 5e8
- nav_at_3: triple assets → NAV = 3e9

#### process_deposit — add 8 tests
- deposit_at_nav_5: correct shares at 5x NAV
- deposit_at_nav_0_1: 10x inflation of shares
- sequential_5_deposits_cumulate: verify totals after 5 deposits
- deposit_rounds_to_zero_at_high_nav_small_amount: small amount → 0 shares
- deposit_mutates_vault_total_assets_and_shares: mutation verified
- deposit_overflow_rejected: massive deposit rejects
- deposit_at_nav_2: half shares
- deposit_at_nav_0_5: double shares

#### process_withdraw — add 7 tests
- withdraw_at_nav_5_returns_5x: 5x assets per share
- withdraw_partial_leaves_correct_remainder: vault updated correctly
- withdraw_1_of_1000_shares: returns 1/1000 * assets
- withdraw_all_drains_vault: 0 assets, 0 shares left
- withdraw_sequential_multiple_users: each pro-rata
- withdraw_overflow_check: u64::MAX shares → Err
- withdraw_underflow_prevented: insufficient assets → Err

#### accrue_fees — add 8 tests
- accrue_zero_elapsed: (0, 0)
- accrue_zero_profit: (mgmt, 0)
- accrue_zero_bps: (0, 0)
- accrue_management_and_performance_together: both correct
- accrue_negative_elapsed_ignored: (0, 0)
- accrue_1_year_all_fees: exact amounts
- accrue_large_profit_no_panic: no crash
- accrue_fees_readonly_vault: vault not mutated

### 1.5 src/state.rs (currently 3 → target 15)

12 new inline tests covering:
- Status code transitions (Fundraising→Active, Active→Dormant)
- Invalid backward transitions
- VaultState byte size matches INIT_SPACE
- _reserved field initialized to [0u8; 64]
- pending_manager defaults to None
- is_paused defaults to false
- high_water_mark invariants
- allowed_output_mints has exactly 4 slots

---

## Layer 2: Data-Driven JSON Matrix Tests (target: 2,800+ vectors)

This is the exact pattern used by Whirlpools — test functions that each load a JSON file and iterate over thousands of structured vectors.

### File Structure

```
tests/
├── common/mod.rs
├── test_fbyt_clone_vault.rs        ← existing integration tests
├── vectors/
│   ├── share_math_vectors.json     ← ~800 test vectors
│   ├── fee_math_vectors.json       ← ~800 test vectors
│   └── pyth_price_vectors.json     ← ~1,200 test vectors
└── vector_test_runner.rs           ← [NEW] data-driven runner
scripts/
├── generate_share_math_vectors.py
├── generate_fee_math_vectors.py
└── generate_pyth_price_vectors.py
```

### JSON Vector Schema (share_math_vectors.json)

```json
[
  {
    "id": 1,
    "description": "bootstrap_1:1_at_zero_assets",
    "function": "calculate_shares_to_mint",
    "inputs": {
      "deposit_amount": "1000000",
      "total_assets": "0",
      "total_shares": "0"
    },
    "expect_ok": true,
    "expected_output": "1000000",
    "expected_error": null
  },
  {
    "id": 2,
    "description": "overflow_MathOverflow",
    "function": "calculate_shares_to_mint",
    "inputs": {
      "deposit_amount": "18446744073709551615",
      "total_assets": "1",
      "total_shares": "18446744073709551615"
    },
    "expect_ok": false,
    "expected_output": null,
    "expected_error": "MathOverflow"
  }
]
```

### Matrix Dimensions

#### share_math_vectors.json (~800 vectors)

`calculate_shares_to_mint` — 3-dimensional matrix:
- deposit_amount × 8 values: 0, 1, 1K, 1M, 1B, 10B, u64::MAX/2, u64::MAX
- total_assets × 7 values: 0, 1, 1K, 1M, 1B, 10B, u64::MAX/2
- total_shares × 7 values: 0, 1, 1K, 1M, 1B, 10B, u64::MAX/2
- Subtotal: 8×7×7 = 392 vectors

`calculate_amount_out` — 3-dimensional matrix:
- shares_to_burn × 6 values: 0, 1, 1K, 1M, 1B, u64::MAX/2
- total_assets × 6 values: 0, 1, 1K, 1M, 1B, 10B
- total_shares × 4 values: 1, 1K, 1M, 1B  (total_shares=0 all become error vectors)
- Subtotal: 6×6×4 = 144 vectors

Total after de-duplication + extra edge cases: ~800 vectors

#### fee_math_vectors.json (~800 vectors)

`calculate_performance_fee` — 2-dimensional:
- profit × 8 values: 0, 1, 100, 1K, 1M, 1B, u64::MAX/2, u64::MAX
- performance_fee_bps × 8 values: 0, 1, 100, 500, 1000, 5000, 9999, 10000
- Subtotal: 8×8 = 64 vectors

`calculate_management_fee` — 3-dimensional:
- total_assets × 7: 0, 1, 100, 1K, 1M, 1B, u64::MAX/10
- management_fee_bps × 8: 0, 1, 50, 100, 200, 500, 1000, 10000
- elapsed_seconds × 8: -1, 0, 1, 3600, 86400, 2628000, 31536000, 63072000
- Subtotal: 7×8×8 = 448 vectors

Total with edge cases: ~800 vectors

#### pyth_price_vectors.json (~1,200 vectors)

`calculate_amount_out` — 5-dimensional:
- amount_in × 6: 1, 1K, 1M, 1B, 10B, u64::MAX/2
- price × 7: -1, 0, 1, 100, 150*1e8, 60000*1e8, i64::MAX/2
- expo × 9: -18, -12, -8, -6, -4, -2, 0, 2, 4
- input_decimals × 3: 0, 6, 9
- output_decimals × 3: 0, 6, 9
- Filtered subset (remove obvious overflows, keep ~1,200): ~1,200 vectors

### Python Generator Script (generate_share_math_vectors.py)

```python
#!/usr/bin/env python3
"""
Generates share_math_vectors.json for fbyt-clone-vault test suite.
Computes expected outputs using reference Python implementation.
"""
import json

DEPOSIT_AMOUNTS = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000,
                   (2**63)-1, (2**64)-1]
TOTAL_ASSETS    = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000, (2**63)-1]
TOTAL_SHARES    = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000, (2**63)-1]

U64_MAX = (2**64) - 1
U128_MAX = (2**128) - 1

def calculate_shares_to_mint(deposit, assets, shares):
    """Reference implementation matching Rust logic."""
    if shares == 0 or assets == 0:
        if deposit > U64_MAX:
            return (False, "MathOverflow")
        return (True, deposit)
    product = deposit * shares
    if product > U128_MAX:
        return (False, "MathOverflow")
    result = product // assets
    if result > U64_MAX:
        return (False, "MathOverflow")
    return (True, result)

def calculate_amount_out(burn, assets, total_shares):
    """Reference implementation matching Rust logic."""
    if total_shares == 0:
        return (False, "MathOverflow")
    product = burn * assets
    if product > U128_MAX:
        return (False, "MathOverflow")
    result = product // total_shares
    if result > U64_MAX:
        return (False, "MathOverflow")
    return (True, result)

cases = []
case_id = 0

# calculate_shares_to_mint matrix
for d in DEPOSIT_AMOUNTS:
    for a in TOTAL_ASSETS:
        for s in TOTAL_SHARES:
            ok, out = calculate_shares_to_mint(d, a, s)
            cases.append({
                "id": case_id,
                "description": f"mint|d={d}|a={a}|s={s}",
                "function": "calculate_shares_to_mint",
                "inputs": {
                    "deposit_amount": str(d),
                    "total_assets": str(a),
                    "total_shares": str(s)
                },
                "expect_ok": ok,
                "expected_output": str(out) if ok else None,
                "expected_error": out if not ok else None,
            })
            case_id += 1

# calculate_amount_out matrix
BURN_AMOUNTS = [0, 1, 1_000, 1_000_000, 1_000_000_000, (2**63)-1]
ASSETS_OUT   = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000]
SHARES_OUT   = [1, 1_000, 1_000_000, 1_000_000_000]

for b in BURN_AMOUNTS:
    for a in ASSETS_OUT:
        for s in SHARES_OUT:
            ok, out = calculate_amount_out(b, a, s)
            cases.append({
                "id": case_id,
                "description": f"out|b={b}|a={a}|s={s}",
                "function": "calculate_amount_out",
                "inputs": {
                    "shares_to_burn": str(b),
                    "total_assets": str(a),
                    "total_shares": str(s)
                },
                "expect_ok": ok,
                "expected_output": str(out) if ok else None,
                "expected_error": out if not ok else None,
            })
            case_id += 1

with open("tests/vectors/share_math_vectors.json", "w") as f:
    json.dump(cases, f, indent=2)

print(f"Generated {len(cases)} share_math test vectors")
```

### Rust Vector Test Runner (tests/vector_test_runner.rs)

```rust
use serde::Deserialize;
use fbyt_clone_vault::math::share_math::{calculate_shares_to_mint, calculate_amount_out as amount_out};
use fbyt_clone_vault::math::fee_math::{calculate_performance_fee, calculate_management_fee};
use fbyt_clone_vault::pyth_price::calculate_amount_out;

#[derive(Deserialize)]
struct ShareMathInputs {
    deposit_amount: Option<String>,
    total_assets: Option<String>,
    total_shares: Option<String>,
    shares_to_burn: Option<String>,
}

#[derive(Deserialize)]
struct VectorCase<I> {
    id: u32,
    description: String,
    function: String,
    inputs: I,
    expect_ok: bool,
    expected_output: Option<String>,
}

fn parse(s: &Option<String>) -> u64 {
    s.as_ref().unwrap().parse().unwrap()
}

fn assert_vector_cases<I, F>(data: &str, runner: F) -> (usize, usize)
where
    I: for<'de> serde::Deserialize<'de>,
    F: Fn(&VectorCase<I>) -> bool,
{
    let cases: Vec<VectorCase<I>> = serde_json::from_str(data).expect("Invalid JSON");
    let mut pass = 0;
    let mut fail = 0;
    let mut fail_msgs = vec![];
    for case in &cases {
        if runner(case) { pass += 1; }
        else {
            fail += 1;
            fail_msgs.push(format!("FAIL #{}: {}", case.id, case.description));
        }
    }
    for m in &fail_msgs { eprintln!("{}", m); }
    (pass, fail)
}

#[test]
fn run_share_math_vector_tests() {
    let data = include_str!("vectors/share_math_vectors.json");
    let cases: Vec<serde_json::Value> = serde_json::from_str(data).unwrap();

    let mut pass = 0usize;
    let mut fail = 0usize;

    for case in &cases {
        let func = case["function"].as_str().unwrap();
        let inputs = &case["inputs"];
        let expect_ok = case["expect_ok"].as_bool().unwrap();

        let p = |key: &str| -> u64 {
            inputs[key].as_str().unwrap().parse().unwrap()
        };

        let result = match func {
            "calculate_shares_to_mint" => calculate_shares_to_mint(
                p("deposit_amount"), p("total_assets"), p("total_shares")
            ),
            "calculate_amount_out" => amount_out(
                p("shares_to_burn"), p("total_assets"), p("total_shares")
            ),
            f => panic!("Unknown: {}", f),
        };

        let ok = if expect_ok {
            match result {
                Ok(v) => {
                    let expected: u64 = case["expected_output"].as_str().unwrap().parse().unwrap();
                    v == expected
                }
                Err(_) => false,
            }
        } else {
            result.is_err()
        };

        if ok { pass += 1; } else { fail += 1; }
    }

    assert_eq!(fail, 0, "{}/{} share_math vector cases failed", fail, pass + fail);
    println!("share_math: {}/{} passed", pass, pass + fail);
}

#[test]
fn run_fee_math_vector_tests() {
    let data = include_str!("vectors/fee_math_vectors.json");
    let cases: Vec<serde_json::Value> = serde_json::from_str(data).unwrap();

    let mut pass = 0usize;
    let mut fail = 0usize;

    for case in &cases {
        let func = case["function"].as_str().unwrap();
        let inputs = &case["inputs"];
        let expect_ok = case["expect_ok"].as_bool().unwrap();

        let pu64 = |key: &str| -> u64 { inputs[key].as_str().unwrap().parse().unwrap() };
        let pu16 = |key: &str| -> u16 { inputs[key].as_str().unwrap().parse().unwrap() };
        let pi64 = |key: &str| -> i64 { inputs[key].as_str().unwrap().parse().unwrap() };

        let result = match func {
            "calculate_performance_fee" => calculate_performance_fee(pu64("profit"), pu16("performance_fee_bps")),
            "calculate_management_fee" => calculate_management_fee(pu64("total_assets"), pu16("management_fee_bps"), pi64("elapsed_seconds")),
            f => panic!("Unknown: {}", f),
        };

        let ok = if expect_ok {
            match result {
                Ok(v) => {
                    let expected: u64 = case["expected_output"].as_str().unwrap().parse().unwrap();
                    v == expected
                }
                Err(_) => false,
            }
        } else {
            result.is_err()
        };

        if ok { pass += 1; } else { fail += 1; }
    }

    assert_eq!(fail, 0, "{}/{} fee_math vector cases failed", fail, pass + fail);
    println!("fee_math: {}/{} passed", pass, pass + fail);
}

#[test]
fn run_pyth_price_vector_tests() {
    let data = include_str!("vectors/pyth_price_vectors.json");
    let cases: Vec<serde_json::Value> = serde_json::from_str(data).unwrap();

    let mut pass = 0usize;
    let mut fail = 0usize;

    for case in &cases {
        let inputs = &case["inputs"];
        let expect_ok = case["expect_ok"].as_bool().unwrap();

        let amount_in: u64 = inputs["amount_in"].as_str().unwrap().parse().unwrap();
        let price: i64 = inputs["price"].as_str().unwrap().parse().unwrap();
        let expo: i32 = inputs["expo"].as_i64().unwrap() as i32;
        let input_decimals: u8 = inputs["input_decimals"].as_u64().unwrap() as u8;
        let output_decimals: u8 = inputs["output_decimals"].as_u64().unwrap() as u8;

        let result = calculate_amount_out(amount_in, price, expo, input_decimals, output_decimals);

        let ok = if expect_ok {
            match result {
                Ok(v) => {
                    let expected: u64 = case["expected_output"].as_str().unwrap().parse().unwrap();
                    v == expected
                }
                Err(_) => false,
            }
        } else {
            result.is_err()
        };

        if ok { pass += 1; } else { fail += 1; }
    }

    assert_eq!(fail, 0, "{}/{} pyth_price vector cases failed", fail, pass + fail);
    println!("pyth_price: {}/{} passed", pass, pass + fail);
}
```

---

## Layer 3: Integration Tests (target: 90 functions)

### 3.1 Initialize Vault (currently 1 → target 10)
- test_init_vault_fee_at_max_boundary (exactly 10000 bps → fails)
- test_init_vault_fee_at_max_minus_1 (9999 bps → succeeds)
- test_init_vault_zero_fee (both fees 0 → success)
- test_init_vault_zero_lockup (lockup=0 → success)
- test_init_vault_zero_min_raise (min_raise=0 → success)
- test_init_vault_wrong_authority_rejected (Unauthorized)
- test_init_vault_duplicate_fails (AlreadyInitialized)
- test_init_vault_duplicate_allowed_mints (same mint in all 4 slots)
- test_init_vault_invalid_share_mint_authority (wrong authority → error)
- test_init_vault_all_fields_set_correctly (full state verification)

### 3.2 Activate Vault (currently 1 → target 8)
- test_activate_fails_below_min_raise (MinRaiseNotMet)
- test_activate_already_active_rejected (VaultLocked)
- test_activate_wrong_manager_rejected (Unauthorized)
- test_activate_when_paused_rejected (VaultPaused)
- test_activate_exact_min_raise_amount (exactly min_raise succeeds)
- test_activate_one_less_than_min_raise_fails (min_raise - 1 → MinRaiseNotMet)
- test_activate_with_zero_min_raise (always succeeds)
- test_activate_transitions_status_to_active (status field verification)

### 3.3 Deposit (currently 2 → target 15)
- test_deposit_when_paused_rejected (VaultPaused)
- test_deposit_when_dormant_rejected (VaultLocked)
- test_deposit_when_fundraising_rejected (VaultLocked)
- test_deposit_zero_amount_rejected (InvalidAmount)
- test_deposit_wrong_mint_rejected (InvalidMint)
- test_deposit_wrong_share_mint_rejected (ShareMintMismatch)
- test_deposit_sequential_5_users (proportional shares)
- test_deposit_after_fee_accrual (correct NAV reflected)
- test_deposit_nav_at_2_half_shares_minted
- test_deposit_nav_at_0_5_double_shares_minted
- test_deposit_mint_correct_share_token_amount (token account balance matches)
- test_deposit_then_withdraw_same_user (round-trip ≤ deposit)
- test_deposit_updates_vault_state (total_assets and total_shares incremented)
- test_deposit_large_amount_success (large valid amount works)
- test_deposit_sequential_verify_nav_constant (NAV stable across deposits)

### 3.4 Withdraw (currently 2 → target 15)
- test_withdraw_all_shares (full withdrawal drains vault)
- test_withdraw_half_shares (correct remainder)
- test_withdraw_zero_shares_rejected (InvalidAmount)
- test_withdraw_more_than_balance_rejected (InsufficientVaultBalance)
- test_withdraw_before_lockup_fails (LockupActive)
- test_withdraw_exactly_at_lockup_expiry (succeeds >= boundary)
- test_withdraw_1_second_before_lockup_fails (LockupActive)
- test_withdraw_when_paused_rejected (VaultPaused)
- test_withdraw_wrong_share_mint_rejected (ShareMintMismatch)
- test_withdraw_when_vault_dormant_rejected (VaultLocked)
- test_withdraw_pro_rata_after_profit (correct assets at NAV=3)
- test_withdraw_sequential_5_users (each gets pro-rata)
- test_withdraw_minimum_1_share (returns >= 0 assets)
- test_withdraw_updates_vault_state (total_assets, total_shares decremented)
- test_withdraw_burns_share_tokens (user share token balance decremented)

### 3.5 Pause / Unpause (currently 1 → target 8)
- test_pause_success
- test_unpause_success
- test_pause_already_paused (idempotent or error)
- test_unpause_when_not_paused (idempotent or error)
- test_pause_wrong_manager (Unauthorized)
- test_unpause_wrong_manager (Unauthorized)
- test_deposit_blocked_when_paused (VaultPaused)
- test_withdraw_blocked_when_paused (VaultPaused)

### 3.6 Manager Rotation (currently 1 → target 8)
- test_set_pending_manager_success
- test_accept_manager_success (rotation complete)
- test_accept_manager_wrong_signer (Unauthorized)
- test_old_manager_rejected_after_rotation
- test_pending_manager_cleared_after_accept
- test_set_pending_wrong_manager (Unauthorized)
- test_double_rotation_overwrites_pending
- test_cannot_accept_without_pending

### 3.7 Deactivate Vault (currently 0 → target 5)
- test_deactivate_success (Active → Dormant)
- test_deactivate_from_fundraising_rejected
- test_deactivate_wrong_manager (Unauthorized)
- test_deactivate_already_dormant (error or idempotent)
- test_deposit_rejected_after_deactivate (VaultLocked)

### 3.8 Collect Fees (currently 1 → target 8)
- test_collect_fees_success_performance
- test_collect_fees_success_management
- test_collect_fees_both_together
- test_collect_fees_zero_accrued_rejected (InvalidAmount)
- test_collect_fees_wrong_manager (Unauthorized)
- test_collect_fees_resets_accrued_to_zero
- test_collect_fees_partial_preserves_vault_assets
- test_collect_fees_emits_correct_event

### 3.9 Execute Trade / Pyth (currently 1 → target 9)
- test_execute_trade_wrong_manager (Unauthorized)
- test_execute_trade_wrong_output_mint (InvalidMint)
- test_execute_trade_when_paused (VaultPaused)
- test_execute_trade_when_dormant (VaultLocked)
- test_execute_trade_stale_price (StalePrice)
- test_execute_trade_confidence_too_wide (PriceConfidenceTooWide)
- test_execute_trade_negative_price_rejected (InvalidTradeParams)
- test_execute_trade_updates_total_assets_deposited
- test_execute_trade_emits_trade_executed_event

---

## Test Count Summary

| Layer | Target Count |
|-------|-------------|
| Layer 1 – Inline Unit Tests | 220 |
| Layer 2 – JSON Matrix: share_math_vectors.json | 800 |
| Layer 2 – JSON Matrix: fee_math_vectors.json | 800 |
| Layer 2 – JSON Matrix: pyth_price_vectors.json | 1,200 |
| Layer 3 – Integration Tests | 90 |
| **TOTAL** | **3,110** |

---

## Prioritized Execution Order

### Red Priority — Data-Driven Matrix (biggest impact, 2,800 new tests at once)
1. Write `scripts/generate_share_math_vectors.py` → run it → produce `share_math_vectors.json`
2. Write `scripts/generate_fee_math_vectors.py` → run it → produce `fee_math_vectors.json`
3. Write `scripts/generate_pyth_price_vectors.py` → run it → produce `pyth_price_vectors.json`
4. Write `tests/vector_test_runner.rs` with 3 runner functions
5. Add `serde` and `serde_json` to `[dev-dependencies]` in Cargo.toml
6. Run `cargo test` → count reaches 2,800+

### Yellow Priority — Integration Scenarios
7. Add all deposit integration tests (15 tests)
8. Add all withdraw integration tests (15 tests)
9. Add all pause/unpause, manager rotation, deactivate tests (21 tests)

### Green Priority — Inline Unit Tests + Collect Fees / Trade
10. Expand inline unit tests in all math modules (+160 tests)
11. Add collect_fees and execute_trade integration scenarios

---

## Implementation Note

The key insight from Whirlpools is that their 3,840-test count comes from ONE `#[test]` function that loops over a JSON array — not 3,840 individual test functions. This is the scalable pattern we adopt. The JSON approach also enables independent verification: the Python script computes expected values using a reference implementation in pure Python, and the Rust runner verifies our on-chain math matches exactly.

This is exactly how auditors want to see vault math proven: an independent reference implementation producing identical outputs confirms the on-chain code is correct.
