<a id="readme-top"></a> 

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <img src="frontend/public/logo.png" alt="Flux Logo" width="120">

  <h1 align="center">📈 Flux Platform</h1>

  <p align="center">
    <strong>Non-Custodial, Vault-Based Investment Platform on Solana!</strong>
    <br />
    A high-performance decentralized platform focusing on efficient data handling, robust state management, and advanced on-chain Oracle integrations.
    <br />
    <br />
    <a href="frontend"><strong>Explore the docs »</strong></a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#what-is-flux">What is Flux?</a>
    </li>
    <li>
      <a href="#why-flux-key-advantages">Why Flux? (Key Advantages)</a>
    </li>
    <li>
      <a href="#key-platform-features">Key Platform Features</a>
    </li>
    <li>
      <a href="#system-architecture">System Architecture</a>
    </li>
    <li>
      <a href="#repository-structure">Repository Structure</a>
    </li>
    <li>
      <a href="#tech-stack">Tech Stack</a>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
    </li>
  </ol>
</details>

## What is Flux?

**Flux** is a non-custodial, vault-based investment platform built on the **Solana blockchain**. It solves UX and performance limitations observed in existing market solutions by providing a seamless, high-performance environment for both fund managers and investors.

Through Flux, managers can create vaults, set fee structures, and execute trades using on-chain **Pyth Network Oracle** data to ensure mathematically pure executions. Investors can deposit SOL or USDC into vaults, receive state-based "Share Tokens," and monitor real-time PnL with lightning-fast WebSocket updates.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Why Flux? (Key Advantages)

* **⚡ Real-Time PnL & WebSocket Updates:** Replaces slow HTTP polling with real-time WebSocket subscriptions pushing updates instantly to the client.
* **🛡️ Non-Custodial Vaults:** Built entirely on Solana using the Anchor framework. Vaults are PDAs (Program Derived Addresses) ensuring funds are secure and completely decentralized.
* **💹 On-Chain Pyth Oracle Integration:** Swap execution relies on live Devnet prices directly from the Pyth Network Price Accounts, ensuring transparent and accurate token conversions.
* **🎯 High-Performance React UI:** Leverages TanStack Start, Zustand for strict quote-locking state, and `@tanstack/react-virtual` for DOM windowing to prevent UI lag on massive vault lists.
* **🔥 State Conflict Resolution:** True isolation between Manager and Investor modes utilizing independent session storage, guaranteeing an intuitive and bug-free user experience.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Key Platform Features

* **Manager Dashboard:** 
  * Vault creation with highly customizable parameters (`minRaiseAmount`, `performanceFee`, `managementFee`, `lockupPeriod`).
  * Advanced management to edit vault metadata (Tags, Focus Assets) synced seamlessly with the Postgres backend.
  * Trade execution directly with the Pyth Oracle AMM, complete with automated fee distribution.
* **Investor Workspace:**
  * Effortless SOL/USDC deposit flows to receive programmatic Share Tokens.
  * Instant in-kind withdrawal capability claiming underlying assets directly from the vault.
  * Live portfolio tracking and real-time dashboard PnL monitoring.
* **System & UX Enhancements:**
  * Centralized dust filtering threshold shared between API and frontend.
  * Advanced pending transaction state store with Solscan block explorer links.
  * Auto-invalidation and cache refetching on successful WebSocket swap confirmations.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## System Architecture

```mermaid
graph TD
    User[Manager/Investor] -->|1. Interacts| Frontend[TanStack Start Webapp]
    Frontend -->|2. Reads/Writes Data| Backend[Golang Gin API]
    Frontend -->|3. Connects| WS[WebSocket Server]
    Backend -->|4. Persists State| DB[(PostgreSQL)]
    Backend -->|5. Interacts| Solana[Solana Devnet Blockchain]
    Solana -->|6. Price Data| Pyth[Pyth Network Oracle]
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Repository Structure

```text
.
├── backend/                # Go (Gin) backend API server & database services
│   ├── cmd/                # Entrypoints (server, seed)
│   ├── internal/           # Handlers, repositories, domain models, WebSocket
│   └── pkg/                # Solana client & shared utilities
├── frontend/               # React + TanStack Start frontend application
│   ├── src/                # Components, routes, hooks, services, stores
│   └── public/             # Static assets and branding
└── contracts/              # Solana Anchor smart contract program
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Real-Time WebSocket Architecture & Performance Optimizations ⚡

Flux delivers institutional-grade real-time market data streaming and state synchronization designed to eliminate network overhead, UI thrashing, and database bottlenecks.

### 1. Zero-HTTP WebSocket Ingestion
* **No Cache Invalidation Storms:** Rather than executing destructive `queryClient.invalidateQueries` calls upon every tick (which triggers heavy cascade HTTP polling), incoming WebSocket events mutate React Query in-memory caches directly.
* **Modular Single-Responsibility Handlers:** Event processing is split into dedicated, isolated handlers (`vaultHandler.ts`, `portfolioSummaryHandler.ts`, `activityHandler.ts`) adhering to the Single Responsibility Principle.

### 2. 200ms Micro-Interval Batch Processing
* **Frame-Rate Protection:** High-frequency event streams (e.g. 50-100 ticks/sec from high-throughput simulation) are buffered in memory and flushed in atomic 200ms batches (~5 FPS batch updates with smooth 60 FPS rendering) via `useBatchedWebSocket`.
* **Zero Component Re-render Thrashing:** Multiple trades, TVL shifts, and portfolio delta updates in the same interval are merged before dispatching a single atomic React Query cache update.

### 3. Dynamic Viewport-Scoped Subscriptions
* **Client-Driven Selective Routing:** Through `useVisibleVaultsWs` and `useRouteWsChannel`, clients only subscribe to channels for items currently in view (`vault:<id>`, `portfolio:<wallet>`, `user:<wallet>`).
* **Clean Channel Diffing:** Navigating between views automatically subscribes to newly visible resources and unsubscribes from off-screen resources without tearing down persistent socket connections.

### 4. Database Pre-Aggregation with PostgreSQL Materialized Views
* **O(1) Portfolio Aggregation:** Database endpoints query the `user_pnl_summary` materialized view directly. The 3 summary metrics (`TOTAL INVESTED`, `PORTFOLIO VALUE`, `NET PROFIT / LOSS`) return pre-computed aggregates in a single row without scanning or iterating over individual position records.
* **Authenticated Session Scope:** Private endpoints (`/api/v1/portfolio/summary`, `/api/v1/portfolio/history`, `/api/v1/transactions`) resolve the user's wallet automatically from session authentication tokens, preventing URL tampering and data scraping.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Market Simulation Engine 🚀

Flux includes a standalone high-frequency market simulator designed to test high-load scenarios, multi-vault price fluctuations, simulated swaps, and investor portfolio updates.

### Running the Simulator

1. **Start the Simulator against a running backend:**
   ```bash
   cd backend
   go run ./cmd/simulator --interval=150 --wallet=<YOUR_CONNECTED_WALLET>
   ```

2. **Available Simulator Options:**
   | Flag | Default | Description |
   | --- | --- | --- |
   | `--interval` | `100` | Tick interval in milliseconds (e.g. `50`, `100`, `250`) |
   | `--wallet` | `""` | Target user wallet to simulate live deposits, swaps, and PnL updates |
   | `--vault` | `""` | Target specific vault ID (if empty, simulates top 10 vaults in DB) |
   | `--ws` | `ws://localhost:8080/api/v1/ws` | WebSocket endpoint URL |
   | `--burst` | `false` | Enable random spike volume and market volatility |
   | `--mode` | `stream` | `stream` (feeder mode) or `client-listener` (benchmark mode) |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Tech Stack

* **Frontend:** React, TanStack Start, TanStack Query, Zustand, TailwindCSS, Lucide Icons
* **Backend:** Go (Gin), PostgreSQL (GORM), TimescaleDB, PgBouncer, Redis, Gorilla WebSocket
* **Smart Contracts:** Solana, Rust, Anchor Framework, Pyth Hermes Oracle

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

Follow these instructions to run the Flux platform on your local machine.

### Prerequisites

* Node.js (v18+)
* Go (v1.22+)
* Docker & Docker Compose

### Quick Start

1. **Clone Repository:**
   ```bash
   git clone https://github.com/your-org/flux.git
   cd flux
   ```

2. **Start Backend Infrastructure & Server:**
   ```bash
   cd backend
   docker compose up -d
   ```

3. **Start Frontend Dev Server:**
   ```bash
   cd ../frontend
   pnpm install
   pnpm run dev
   ```

4. **Launch the High-Frequency Simulator:**
   ```bash
   cd ../backend
   go run ./cmd/simulator --interval=150 --wallet=<CONNECTED_WALLET>
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>
