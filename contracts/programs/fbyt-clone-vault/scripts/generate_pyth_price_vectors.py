#!/usr/bin/env python3
import json

U64_MAX = (1 << 64) - 1
U128_MAX = (1 << 128) - 1

AMOUNT_IN = [1, 1000, 10**6, 10**9, 10*10**9, (2**63) - 1]
PRICE = [-1, 0, 1, 100, 150*10**8, 60000*10**8, (2**63) >> 1]
EXPO = [-18, -12, -8, -6, -4, -2, 0, 2, 4]
IN_DEC = [0, 6, 9]
OUT_DEC = [0, 6, 9]

def calc_pyth(amount_in, price, expo, in_dec, out_dec):
    if price <= 0:
        return (False, "InvalidTradeParams")
    total = expo + out_dec - in_dec
    if total >= 0:
        mult = 10**total
        if mult > U64_MAX:
            return (False, "MathOverflow")
        val = amount_in * price * mult
        if val > U128_MAX or val > U64_MAX:
            return (False, "MathOverflow")
        return (True, val)
    else:
        div = 10**(-total)
        if div > U64_MAX:
            return (False, "MathOverflow")
        prod = amount_in * price
        if prod > U128_MAX:
            return (False, "MathOverflow")
        val = prod // div
        if val > U64_MAX:
            return (False, "MathOverflow")
        return (True, val)

cases = []
case_id = 0
INTERESTING_PRICES = (1, 150*10**8)
INTERESTING_EXPOS = (-8, 0)
for amount in AMOUNT_IN:
    for price in PRICE:
        for expo in EXPO:
            for in_dec in IN_DEC:
                for out_dec in OUT_DEC:
                    keep = (case_id % 3 == 0) or (
                        price in INTERESTING_PRICES and expo in INTERESTING_EXPOS
                    )
                    if not keep:
                        case_id += 1
                        continue
                    ok, out = calc_pyth(amount, price, expo, in_dec, out_dec)
                    cases.append({
                        "id": case_id,
                        "description": f"pyth|a={amount}|p={price}|e={expo}|in={in_dec}|out={out_dec}",
                        "function": "calculate_amount_out",
                        "inputs": {
                            "amount_in": str(amount),
                            "price": str(price),
                            "expo": expo,
                            "input_decimals": in_dec,
                            "output_decimals": out_dec,
                        },
                        "expect_ok": ok,
                        "expected_output": str(out) if ok else None,
                        "expected_error": out if not ok else None,
                    })
                    case_id += 1

with open("tests/vectors/pyth_price_vectors.json", "w") as f:
    json.dump(cases, f, indent=2)
print(f"Generated {len(cases)} pyth_price vectors")
