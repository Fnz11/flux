#!/usr/bin/env python3
import json

U64_MAX = (2**64)-1
U128_MAX = (2**128)-1
YEAR = 31536000

def calc_perf(profit, bps):
    return (True, (profit*bps)//10000) if (profit*bps)<=U128_MAX and ((profit*bps)//10000)<=U64_MAX else (False,"MathOverflow")

def calc_mgmt(assets, bps, elapsed):
    if elapsed <= 0:
        return (True, 0)
    num = assets*bps*elapsed
    if num > U128_MAX:
        return (False,"MathOverflow")
    val = num // (10000*YEAR)
    if val > U64_MAX:
        return (False,"MathOverflow")
    return (True, val)

cases = []
case_id = 0

PROFIT = [0, 1, 100, 1_000, 1_000_000, 1_000_000_000, (2**63)-1, (2**64)-1]
PERF_BPS = [0, 1, 100, 500, 1000, 5000, 9999, 10000]
for p in PROFIT:
    for b in PERF_BPS:
        ok, out = calc_perf(p, b)
        cases.append({"id": case_id, "description": f"perf|profit={p}|bps={b}",
            "function": "calculate_performance_fee",
            "inputs": {"profit": str(p), "performance_fee_bps": str(b)},
            "expect_ok": ok, "expected_output": str(out) if ok else None,
            "expected_error": out if not ok else None})
        case_id += 1

ASSETS = [0, 1, 100, 1_000, 1_000_000, 1_000_000_000, (U64_MAX)//10]
MGMT_BPS = [0, 1, 50, 100, 200, 500, 1000, 10000]
ELAPSED = [-1, 0, 1, 3600, 86400, 2628000, 31536000, 63072000]
for a in ASSETS:
    for b in MGMT_BPS:
        for e in ELAPSED:
            ok, out = calc_mgmt(a, b, e)
            cases.append({"id": case_id, "description": f"mgmt|a={a}|bps={b}|e={e}",
                "function": "calculate_management_fee",
                "inputs": {"total_assets": str(a), "management_fee_bps": str(b), "elapsed_seconds": str(e)},
                "expect_ok": ok, "expected_output": str(out) if ok else None,
                "expected_error": out if not ok else None})
            case_id += 1

with open("tests/vectors/fee_math_vectors.json", "w") as f:
    json.dump(cases, f, indent=2)
print(f"Generated {len(cases)} fee_math vectors")
