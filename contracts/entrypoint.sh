#!/usr/bin/env bash
set -euo pipefail

echo "Starting Solana local validator with all supported tokens & Pyth feeds..."

ACCOUNT_ARGS=()

# Load all token mint fixtures dynamically from /workspace/tokens
if [ -d "/workspace/tokens" ]; then
    for f in /workspace/tokens/*.json; do
        if [ -f "$f" ]; then
            # Extract pubkey from json file using python/jq
            PUBKEY=$(python3 -c "import json; print(json.load(open('$f'))['pubkey'])" 2>/dev/null || true)
            if [ -n "$PUBKEY" ]; then
                ACCOUNT_ARGS+=(--account "$PUBKEY" "$f")
                echo "  + Loaded token mint: $PUBKEY ($(basename "$f"))"
            fi
        fi
    done
fi

# Load legacy token files if present
for f in /workspace/usdc_mint.json /workspace/usdt_mint.json /workspace/jup_mint.json /workspace/pyth_mint.json; do
    if [ -f "$f" ]; then
        PUBKEY=$(python3 -c "import json; print(json.load(open('$f'))['pubkey'])" 2>/dev/null || true)
        if [ -n "$PUBKEY" ]; then
            ACCOUNT_ARGS+=(--account "$PUBKEY" "$f")
        fi
    fi
done

# Load Pyth price feed update account if present
if [ -f "/workspace/pyth_price_update.json" ]; then
    ACCOUNT_ARGS+=(--account "5LbY84L6Z1iFFnu9YysHFHq5tHTHYsiLUDNnqf9PNdMw" "/workspace/pyth_price_update.json")
    echo "  + Loaded Pyth price feed account"
fi

echo "Launching solana-test-validator with ${#ACCOUNT_ARGS[@]} account arguments..."

exec solana-test-validator \
    --reset \
    --bpf-program FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais /workspace/target/deploy/flux_vault.so \
    "${ACCOUNT_ARGS[@]}"
