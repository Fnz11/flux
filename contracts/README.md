# Flux Vault
 
Solana Anchor program for non-custodial vault-based investment on Devnet.

## Purpose

Managers create vaults with configurable fees and lockup periods. Investors
deposit SOL/USDC into vaults and receive share tokens. Withdrawals return
proportional in-kind assets. Managers execute swaps priced by the Pyth Oracle
(burn input token, mint exact output token at live oracle price). All actions
emit events for offchain indexing by a Go/Gin backend.

## Major Concepts

### VaultState PDA
- Seeded with `["vault", manager_pubkey]`
- Stores manager, fee config, lockup period, share accounting, status
- Status lifecycle: Fundraising -> Active -> Dormant

### Vault Authority PDA
- Seeded with `["vault_authority", vault_pubkey]`
- Owns all vault token accounts and the share token mint
- Signs all token CPIs (burn, mint, transfer)

### Instructions

- **initialize_vault** -- Creates VaultState PDA, share token mint, and vault
  authority PDA. Manager sets fees and lockup.
- **deposit** -- Transfers tokens from investor to vault, mints proportional
  share tokens using checked arithmetic.
- **withdraw** -- Burns share tokens, returns proportional in-kind assets.
  Enforces lockup period check.
- **execute_trade_pyth** -- Manager-only. Reads live Pyth Oracle price, burns
  input tokens, mints exact output tokens at oracle rate. Slippage
  protection via min_amount_out.

## Setup

Prerequisites: Rust, Solana CLI, Anchor CLI 1.0+.

```sh
anchor build
```

## Testing

```sh
anchor test
```

Tests use LiteSVM - a fast, deterministic Solana runtime in Rust. Test files
live in `programs/flux-vault/tests/`.

## Deployment

```sh
anchor deploy --provider.cluster devnet
```

## Program ID

`FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais` (Devnet)
