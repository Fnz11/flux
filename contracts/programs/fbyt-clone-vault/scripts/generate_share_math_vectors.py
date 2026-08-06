#!/usr/bin/env python3
import json

DEPOSIT_AMOUNTS = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000, (2**63)-1, (2**64)-1]
TOTAL_ASSETS = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000, (2**63)-1]
TOTAL_SHARES = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000, (2**63)-1]
U64_MAX = (2**64)-1
U128_MAX = (2**128)-1

def calculate_shares_to_mint(deposit, assets, shares):
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
for d in DEPOSIT_AMOUNTS:
    for a in TOTAL_ASSETS:
        for s in TOTAL_SHARES:
            ok, out = calculate_shares_to_mint(d, a, s)
            cases.append({"id": case_id, "description": f"mint|d={d}|a={a}|s={s}",
                "function": "calculate_shares_to_mint",
                "inputs": {"deposit_amount": str(d), "total_assets": str(a), "total_shares": str(s)},
                "expect_ok": ok, "expected_output": str(out) if ok else None,
                "expected_error": out if not ok else None})
            case_id += 1

BURN_AMOUNTS = [0, 1, 1_000, 1_000_000, 1_000_000_000, (2**63)-1]
ASSETS_OUT   = [0, 1, 1_000, 1_000_000, 1_000_000_000, 10_000_000_000]
SHARES_OUT   = [1, 1_000, 1_000_000, 1_000_000_000]
for b in BURN_AMOUNTS:
    for a in ASSETS_OUT:
        for s in SHARES_OUT:
            ok, out = calculate_amount_out(b, a, s)
            cases.append({"id": case_id, "description": f"out|b={b}|a={a}|s={s}",
                "function": "calculate_amount_out",
                "inputs": {"shares_to_burn": str(b), "total_assets": str(a), "total_shares": str(s)},
                "expect_ok": ok, "expected_output": str(out) if ok else None,
                "expected_error": out if not ok else None})
            case_id += 1

with open("tests/vectors/share_math_vectors.json", "w") as f:
    json.dump(cases, f, indent=2)
print(f"Generated {len(cases)} share_math vectors")
