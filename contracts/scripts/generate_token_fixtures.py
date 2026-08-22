import json
import base64
import struct
import os

tokens = [
    {"symbol": "USDC", "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "decimals": 6},
    {"symbol": "USDT", "mint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", "decimals": 6},
    {"symbol": "JUP", "mint": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", "decimals": 6},
    {"symbol": "PYTH", "mint": "HZ1Jov2PwbShAi4evWKGAkgg5qUpWVKidGiEw6JH5W73", "decimals": 6},
    {"symbol": "RAY", "mint": "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", "decimals": 6},
    {"symbol": "ORCA", "mint": "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", "decimals": 6},
    {"symbol": "KMNO", "mint": "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS", "decimals": 6},
    {"symbol": "DRIFT", "mint": "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7", "decimals": 6},
    {"symbol": "JTO", "mint": "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", "decimals": 9},
    {"symbol": "mSOL", "mint": "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", "decimals": 9},
    {"symbol": "RENDER", "mint": "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", "decimals": 8},
    {"symbol": "HNT", "mint": "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux", "decimals": 8},
    {"symbol": "NOS", "mint": "nosXBVoaCTtYdLvKY6Csb4AC8JCdQKKAaWYtx2ZMoo7", "decimals": 6},
    {"symbol": "WBTC", "mint": "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", "decimals": 8},
    {"symbol": "WETH", "mint": "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", "decimals": 8},
    {"symbol": "BLZE", "mint": "BLZEEuZUBVqFhj8adcCFPJvPVCiCyVmh3hkJMrU8KuJA", "decimals": 9},
]

out_dir = os.path.join(os.path.dirname(__file__), "..", "tokens")
os.makedirs(out_dir, exist_ok=True)

for t in tokens:
    data = bytearray(82)
    struct.pack_into("<I", data, 0, 1)  # mint_authority_option = 1
    data[4:36] = b"\x01" * 32  # mint_authority
    supply = 10_000_000_000 * (10 ** t["decimals"])
    struct.pack_into("<Q", data, 36, supply)
    data[44] = t["decimals"]
    data[45] = 1  # is_initialized
    b64_data = base64.b64encode(data).decode("utf-8")

    acc = {
        "pubkey": t["mint"],
        "account": {
            "lamports": 1000000000,
            "data": [b64_data, "base64"],
            "owner": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            "executable": False,
            "rentEpoch": 0,
        },
    }
    filename = f"{t['symbol'].lower()}_mint.json"
    file_path = os.path.join(out_dir, filename)
    with open(file_path, "w") as f:
        json.dump(acc, f, indent=2)

print(f"Generated {len(tokens)} token mint JSON fixtures in {out_dir}")
