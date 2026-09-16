# Flux Backend

This is the Go (Gin) backend API server for the Flux platform. It handles API requests, database interactions, and WebSocket subscriptions.

## Prerequisites

- Go (v1.22+)
- Docker & Docker Compose
- Solana CLI tools (optional, for localnet testing)

## Setup & Running

The easiest way to run the backend along with all its dependencies (PostgreSQL, Redis, and Solana Localnet) is via Docker Compose from the root directory:

```bash
cd ..
docker-compose up -d
```

This will spin up:
- **timescaledb** (Port 5432)
- **pgbouncer** (Port 6432)
- **redis** (Port 6379)
- **contracts** (Solana Test Validator on Port 8899)

Once the infrastructure is running, start the API server:
```bash
go run cmd/server/main.go
```

## Database Seeding

The platform includes a robust database seeder that generates a realistic dataset using real Solana keypairs, actual SOL airdrops, and real on-chain `system.Transfer` signatures.

### Why Seeding Might Fail

If you try to run the seeder and it fails, it is typically due to one of the following reasons:

1. **Solana Test Validator is not running**: The seeder connects to `http://localhost:8899` by default. If the validator isn't running, the seeder will fail when attempting to airdrop SOL. Ensure you ran `docker-compose up -d contracts` from the root directory.
2. **PostgreSQL Connection via PgBouncer**: By default, the app uses PgBouncer (Port 6432) in transaction mode. However, the seeder requires a direct connection to PostgreSQL (Port 5432) because it executes heavy database operations, truncates tables, and refreshes materialized views concurrently—actions that PgBouncer blocks.

### How to Run the Seeder

To successfully run the seeder, you must provide a `DIRECT_DATABASE_URL` pointing directly to the TimescaleDB port (5432) instead of PgBouncer (6432).

1. Ensure the infrastructure is running:
   ```bash
   docker-compose up -d
   ```

2. Run the seeder with the direct database URL:
   ```bash
   export DIRECT_DATABASE_URL="postgres://postgres:postgres@localhost:5432/flux?sslmode=disable"
   go run cmd/seed/main.go
   ```

#### Seeder Options

You can customize the seeded data using flags. The defaults are:
- `--users 30` (minimum 25)
- `--vaults-per-user 5` (minimum 4)
- `--trades-per-vault 14`
- `--clean` (add this flag to wipe existing data before seeding)

Example of a custom seed run with cleanup:
```bash
go run cmd/seed/main.go --users 50 --vaults-per-user 10 --clean
```

## High-Frequency WebSocket Simulator

To test fast-changing market data, real-time UI re-renders, and WebSocket throughput under high-frequency conditions locally, use the simulator tool:

```bash
go run cmd/simulator/main.go [options]
```

### Simulator Flags:
- `--interval <ms>`: Frequency interval between ticks in milliseconds (default: `100`).
- `--burst`: Enable burst mode to simulate crypto volatility spikes (default: `false`).
- `--wallet <address>`: Focus updates on a specific user's wallet address.
- `--vault <id>`: Focus updates on a specific vault.
- `--mode <stream|client-listener>`:
  - `stream` (default): Broadcasts continuous trades, vault updates, and Brownian PnL walks to WebSocket channels.
  - `client-listener`: Connects as a WebSocket client to `ws://localhost:8080/ws` and measures throughput / message latency.

### Examples:
```bash
# Run 50ms rapid market stream with volatility bursts
go run cmd/simulator/main.go --interval 50 --burst

# Target a specific test wallet & vault
go run cmd/simulator/main.go --wallet "YOUR_WALLET_PUBKEY" --vault "VAULT_UUID" --interval 100

# Benchmark client throughput & latency
go run cmd/simulator/main.go --mode client-listener --ws "ws://localhost:8080/ws"
```

