
# Backend Optimization Execution Plan (opt-1.md)

## Overview

This document outlines the detailed execution plan for backend database and performance optimizations. The work is distributed across **10 distinct AI Subagents** to ensure parallel execution, minimal context switching, and strict separation of concerns.

**Target Optimizations:**

1. Materialized Views (PNL, Portfolio, etc.)
2. B-Tree Indexes
3. TimescaleDB (TSDB) for Time-Series Data
4. PgBouncer for Connection Pooling
5. Caching Layer (Redis)

---

## 🤖 Subagent 1: Infrastructure & Extensions Setup

**Role:** DevOps & Database Administrator
**Objective:** Provision and configure the core optimization extensions and services.
**Tasks:**

* **Task 1.1:** Enable the `timescaledb` extension on the existing PostgreSQL instance (`CREATE EXTENSION IF NOT EXISTS timescaledb;`).
* **Task 1.2:** Configure **PgBouncer**. Set up `pgbouncer.ini` with `pool_mode = transaction` to optimize for high-concurrency API requests.
* **Task 1.3:** Configure the Redis instance (or equivalent) for the caching layer.
* **Task 1.4:** Update backend environment variables to route DB connections through PgBouncer (usually port 6432) instead of direct Postgres (5432).

## 🤖 Subagent 2: Time-Series Database (TSDB) Migration

**Role:** Database Architect
**Objective:** Convert appropriate existing tables to TimescaleDB hypertables.
**Tasks:**

* **Task 2.1:** Identify time-series heavy tables (e.g., `trades`, `price_history`, `audit_logs`).
* **Task 2.2:** Write migration scripts to convert these tables into hypertables using `SELECT create_hypertable('table_name', 'time_column');`.
* **Task 2.3:** Implement TimescaleDB retention policies (e.g., drop raw price data older than 1 year or downsample it).
* **Task 2.4:** Implement continuous aggregates for OHLCV (Open, High, Low, Close, Volume) data if applicable.

## 🤖 Subagent 3: B-Tree Indexing Strategy

**Role:** Query Optimizer
**Objective:** Reduce sequential scans on high-traffic tables.
**Tasks:**

* **Task 3.1:** Analyze query patterns to identify missing indexes on foreign keys (e.g., `user_id`, `asset_id`).
* **Task 3.2:** Write SQL migrations to create **B-Tree indexes** on high-cardinality columns used in `WHERE` and `JOIN` clauses.
* **Task 3.3:** Implement composite B-Tree indexes for frequently combined filters (e.g., `CREATE INDEX idx_user_asset ON portfolios (user_id, asset_id);`).
* **Task 3.4:** Add `EXPLAIN ANALYZE` scripts to verify the B-Tree indexes are actively being utilized by the query planner.

## 🤖 Subagent 4: Materialized Views (SQL Layer)

**Role:** SQL Developer
**Objective:** Pre-calculate heavy aggregations (PNL, Portfolio balances).
**Tasks:**

* **Task 4.1:** Write the SQL query for the `portfolio_summary` Materialized View (aggregating current holdings, average buy prices).
* **Task 4.2:** Write the SQL query for the `user_pnl_summary` Materialized View (calculating realized and unrealized PNL).
* **Task 4.3:** Create the materialized views (`CREATE MATERIALIZED VIEW ...`).
* **Task 4.4:** Create **UNIQUE B-Tree indexes** on the materialized views (e.g., on `user_id`) to allow for `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

## 🤖 Subagent 5: Materialized View Refresh Workers

**Role:** Backend Background Job Engineer
**Objective:** Keep Materialized Views up-to-date without blocking API requests.
**Tasks:**

* **Task 5.1:** Set up a background worker/cron scheduler in the backend (e.g., using Go cron or similar task queue).
* **Task 5.2:** Implement a job to execute `REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_summary` every X minutes.
* **Task 5.3:** Implement event-driven triggers (optional) to refresh specific rows or views when massive trades occur.
* **Task 5.4:** Add telemetry/logs to monitor the execution time of the refresh jobs.

## 🤖 Subagent 6: Caching Infrastructure (Backend Layer)

**Role:** Backend Systems Engineer
**Objective:** Establish the foundation for the Redis caching layer.
**Tasks:**

* **Task 6.1:** Integrate the Redis client into the backend (e.g., `go-redis/redis`).
* **Task 6.2:** Create a generic caching service interface (methods: `Set`, `Get`, `Delete`, `SetWithTTL`).
* **Task 6.3:** Implement a serialization wrapper to easily marshal/unmarshal struct data (e.g., JSON or Protocol Buffers) to/from Redis strings.
* **Task 6.4:** Define global cache key naming conventions (e.g., `app:user:{id}:portfolio`).

## 🤖 Subagent 7: Read-Path Optimization (Cache Aside)

**Role:** API Read Path Developer
**Objective:** Intercept read-heavy API requests and serve them from Cache or Materialized Views.
**Tasks:**

* **Task 7.1:** Update the `GetPortfolio` use-case/service to implement the Cache-Aside pattern (check Redis -> if miss, query Materialized View -> save to Redis).
* **Task 7.2:** Update the `GetUserPNL` use-case to serve data from the Materialized View and cache the result.
* **Task 7.3:** Implement short TTLs (e.g., 30-60 seconds) for volatile data like active order books or live prices.
* **Task 7.4:** Implement fallback logic if Redis is unreachable (gracefully degrade to querying DB directly).

## 🤖 Subagent 8: Write-Path Optimization (Cache Invalidation)

**Role:** API Write Path Developer
**Objective:** Ensure data consistency when state changes.
**Tasks:**

* **Task 8.1:** Hook into the mutation endpoints (e.g., `CreateTrade`, `UpdateDeposit`).
* **Task 8.2:** Implement targeted cache invalidation. When a trade is executed, delete the specific `app:user:{id}:portfolio` cache key.
* **Task 8.3:** Implement pattern-based invalidation for list endpoints (e.g., deleting `app:global:leaderboard` when rankings shift).
* **Task 8.4:** Ensure write operations properly utilize the PgBouncer transaction pool without holding connections open during external API calls.

## 🤖 Subagent 9: Repository & Clean Architecture Alignment

**Role:** Software Architect
**Objective:** Ensure optimizations fit perfectly into the existing backend architecture.
**Tasks:**

* **Task 9.1:** Update the Repository interfaces to support TimescaleDB specific queries (e.g., `time_bucket` functions).
* **Task 9.2:** Create a `Decorator` pattern or proxy for Repositories to handle caching without polluting the core business logic.
* **Task 9.3:** Ensure all database transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) are PgBouncer-safe (avoid session-level state like advisory locks unless using session pooling).
* **Task 9.4:** Update unit tests to mock the new Caching and TSDB repository layers.

## 🤖 Subagent 10: Performance Testing & Metrics

**Role:** QA & Reliability Engineer
**Objective:** Validate that the optimizations actually improved performance.
**Tasks:**

* **Task 10.1:** Write load testing scripts (e.g., using k6 or Locust) targeting the Portfolio and PNL read endpoints.
* **Task 10.2:** Monitor DB CPU usage and verify that sequential scans have dropped due to B-Tree indexes.
* **Task 10.3:** Monitor PgBouncer connection queues to ensure no connection starvation under heavy load.
* **Task 10.4:** Measure Redis cache hit/miss ratio and adjust TTLs based on the findings.
