# Fix Plan: `docker compose up` Issues

> **Goal**: Make all three stacks — **contracts** (`fbyt-contracts`), **frontend** (`fbyt-frontend`), and **backend infra** (`fbyt-pgbouncer`, `fbyt-timescaledb`, `fbyt-redis`) — run cleanly with a single `docker compose up`.

---

## Table of Contents

1. [Issue Summary](#1-issue-summary)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Fix Plan: Contracts — surfpool missing](#3-fix-plan-contracts-fbyt-contracts)
4. [Fix Plan: anchor-spl IDL-build Warning](#4-fix-plan-anchor-spl-idl-build-warning)
5. [Fix Plan: Stack Overflow Warning](#5-fix-plan-stack-overflow-warning-regex_automata)
6. [Fix Plan: Missing Backend Service](#6-fix-plan-missing-backend-service)
7. [Fix Plan: restart policy crash-loop](#7-fix-plan-restart-unless-stopped-on-contracts)
8. [Execution Order](#8-execution-order)
9. [Verification Checklist](#9-verification-checklist)

---

## 1. Issue Summary

| # | Container | Symptom | Severity |
|---|-----------|---------|----------|
| 1 | `fbyt-contracts` | `Error: Failed to spawn 'surfpool': No such file or directory (os error 2)` → crash-loop | CRITICAL / Blocking |
| 2 | `fbyt-contracts` | `WARNING: 'idl-build' feature of crate 'anchor-spl' is enabled by default` | Warning |
| 3 | `fbyt-contracts` | `Stack offset of 5136 exceeded max offset of 4096` (regex_automata) | Warning |
| 4 | `docker-compose.yml` | No backend Go API service defined; only infra (DB/cache) present | Likely Blocking |
| 5 | `docker-compose.yml` | `contracts` has `restart: unless-stopped`, causing infinite crash-loop | Operational issue |

---

## 2. Root Cause Analysis

### Issue 1 — `surfpool` not found (critical)

**Anchor v1.0.x** (the version in `solanafoundation/anchor:v1.0.2`) replaced `solana-test-validator` with **Surfpool** as the default local network backend. When `anchor localnet` runs inside the container, it tries to exec the `surfpool` binary as a subprocess — but the Docker image does NOT bundle `surfpool`. The OS returns `ENOENT` (No such file or directory), and the process exits with code 1.

Because `docker-compose.yml` has `restart: unless-stopped` on the `contracts` service, Docker keeps restarting it every ~60 s in an endless crash-loop.

**Evidence in logs**: The `cargo test` phase actually succeeds (all test binaries run and begin). The crash occurs only when the Anchor CLI subprocess tries to exec `surfpool` for the localnet step.

### Issue 2 — `anchor-spl/idl-build` in runtime dependency

In `contracts/programs/fbyt-clone-vault/Cargo.toml` line 20:
```
anchor-spl = { version = "1.0.2", features = ["idl-build"] }
```
The `idl-build` feature is only meant to activate during IDL generation builds (via the crate's own feature gate), not as a default runtime dependency. Anchor warns every build because this feature is designed to be conditional, not always-on.

### Issue 3 — `regex_automata` large stack frame

The `litesvm` test harness transitively pulls in `regex_automata`, which has a function with a 10,432-byte stack frame, exceeding the 4,096-byte SBPF stack limit. This warning is emitted by the SBPF verifier during build. It does not fail the build but could cause a runtime panic if that code path is hit on-chain.

### Issue 4 — No backend Go API service

The root `docker-compose.yml` defines only infra services (`timescaledb`, `pgbouncer`, `redis`) plus CI-only test profiles. The Go backend application (`./backend`) is not included. The backend has its own `backend/docker-compose.yml` but it is not linked or merged. For full-stack `docker compose up`, the backend API must be added to the root compose file.

### Issue 5 — crash-loop amplifies noise

`restart: unless-stopped` is correct for long-running healthy services but wrong for a fatally misconfigured service. While contracts is broken, this policy turns one crash into a flood of log noise every ~60 s, making it harder to debug other issues.

---

## 3. Fix Plan: Contracts (`fbyt-contracts`)

Two options are available. **Option A** is the correct long-term fix. **Option B** is a fast workaround if Surfpool cannot be installed inside the container easily.

---

### 3a. Option A — Install `surfpool` in the Dockerfile (Preferred)

**File to edit**: `contracts/Dockerfile`

**What to do**: Add a step that installs the `surfpool` binary before the `anchor build` and `CMD` steps.

**Step 1** — Find the correct surfpool version compatible with Anchor v1.0.2:
- Check https://github.com/txtx/surfpool/releases for the latest release.
- Confirm against Anchor v1.0.2 release notes which surfpool version it expects.

**Step 2** — Add to `contracts/Dockerfile` after the `FROM` line, before `WORKDIR`:

```dockerfile
# Install surfpool — required by anchor localnet (Anchor v1.x default validator)
# Option A1: build from crates.io (slow, ~10-15 min)
RUN cargo install surfpool --locked

# Option A2: download pre-built binary (fast, ~30 sec) — preferred
# Replace <VERSION> with the actual tag from https://github.com/txtx/surfpool/releases
RUN set -eux; \
    SURFPOOL_VERSION="<VERSION>"; \
    curl -fsSL "https://github.com/txtx/surfpool/releases/download/${SURFPOOL_VERSION}/surfpool-x86_64-unknown-linux-gnu.tar.gz" \
      | tar -xz -C /usr/local/bin surfpool; \
    chmod +x /usr/local/bin/surfpool; \
    surfpool --version
```

**Step 3** — Verify the binary is on PATH with a smoke-test line:
```dockerfile
RUN surfpool --version
```

**Step 4** — Keep the rest of the Dockerfile unchanged. The `CMD ["anchor", "localnet"]` line works as-is once surfpool is available.

**Expected result**: `anchor localnet` will successfully spawn `surfpool`, the Solana local validator will start, the program will be deployed, and ports 8899/8900 will become available.

---

### 3b. Option B — Switch to legacy `solana-test-validator` (Quick Workaround)

**Files to edit**: `contracts/Dockerfile` and `contracts/Anchor.toml`

**What to do**: Use the `--validator legacy` flag so Anchor falls back to `solana-test-validator`, which IS already bundled in the `solanafoundation/anchor:v1.0.2` image.

**Step 1** — Update `contracts/Dockerfile` CMD:
```dockerfile
CMD ["anchor", "localnet", "--validator", "legacy"]
```

**Step 2** — Optionally pin this in `contracts/Anchor.toml` under `[features]`:
```toml
[features]
resolution = true
skip-lint = false
validator = "legacy"
```

**Trade-off**: Loses Surfpool's mainnet-forking and faster boot features, but works immediately with zero new binary installation. Good for unblocking FE/BE development quickly.

---

## 4. Fix Plan: `anchor-spl` IDL-build Warning

**File to edit**: `contracts/programs/fbyt-clone-vault/Cargo.toml`

**What to do**: Remove `"idl-build"` from the runtime features list of `anchor-spl`. It should only appear under the crate's own `idl-build` feature (line 16), which is already correct.

**Current** (line 20):
```toml
anchor-spl = { version = "1.0.2", features = ["idl-build"] }
```

**Change to**:
```toml
anchor-spl = { version = "1.0.2" }
```

The `idl-build` feature for `anchor-spl` is already correctly wired in the `[features]` table:
```toml
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
```

That pattern is correct — `anchor-spl/idl-build` gets activated only when this crate itself is compiled with `--features idl-build` (which Anchor CLI does automatically during IDL generation). Removing it from the direct dependency eliminates the warning.

**Verification**: After the change, rebuild and confirm the `WARNING: 'idl-build' feature of crate 'anchor-spl' is enabled by default` line no longer appears.

---

## 5. Fix Plan: Stack Overflow Warning (`regex_automata`)

**Context**: This warning originates from `litesvm` → `regex_automata` being compiled as a native test dependency. The SBPF verifier checks stack frames during build.

**File to check**: `contracts/programs/fbyt-clone-vault/Cargo.toml` `[dev-dependencies]`

**What to do**:

**Step 1** — Determine if this is actually causing test failures:
Run `cargo test` inside the container (or locally) and check if any test panics due to stack overflow. If all tests pass, the warning is benign for the current test suite.

**Step 2** — If warning must be eliminated: check if a newer `litesvm` patch version resolves the issue:
```toml
# In [dev-dependencies], try bumping
litesvm = "=0.15.3"   # or latest
```
Verify the new version still compiles with the pinned solana crate versions in the same `[dev-dependencies]` block.

**Step 3** — If the version cannot be changed, accept and document the warning:
Add a comment in `Cargo.toml`:
```toml
# litesvm 0.15.2 transitively pulls regex_automata which has a large stack
# frame that triggers the SBPF verifier warning. The warning is benign because
# this code path runs in native test binaries, not on-chain BPF. See Issue #XXX.
litesvm = "=0.15.2"
```

**Step 4** — Docker-only cosmetic mitigation (optional):
To prevent the warning from obscuring other output during `anchor build`, suppress it in the Dockerfile:
```dockerfile
# Suppress noisy SBPF stack-frame warning (cosmetic only — does not affect correctness)
ENV SBF_SDK_PATH=/opt/solana/bin/sdk/sbf
```
(Exact env var depends on the Anchor image internals — investigate if needed.)

---

## 6. Fix Plan: Missing Backend Service

**File to edit**: `docker-compose.yml` (root level)

**What to do**: Add the Go backend API service so `docker compose up` starts the full stack.

**Step 1** — Check if a `Dockerfile` already exists in `./backend`:
```bash
find ./backend -name Dockerfile
```

**Step 2** — Check the Go entrypoint and listen port:
```bash
ls ./backend/cmd/
# Look for main.go or the server command entry
grep -r "ListenAndServe\|:8080\|PORT" ./backend/cmd/ | head -20
```
Also read `backend/.env.example` to understand what env vars the app needs.

**Step 3** — If `backend/Dockerfile` exists, add this block to root `docker-compose.yml` under the `contracts` service:

```yaml
  # ---------------------------------------------------------
  # BACKEND API (Go)
  # ---------------------------------------------------------
  backend:
    build:
      context: ./backend
    container_name: fbyt-backend
    ports:
      - "8080:8080"        # adjust to match actual app port
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@pgbouncer:6432/${POSTGRES_DB:-fbyt}?sslmode=disable
      REDIS_URL: redis://redis:6379
      SOLANA_RPC_URL: http://contracts:8899
    depends_on:
      pgbouncer:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

**Step 4** — If `backend/Dockerfile` does NOT exist, create one:

```dockerfile
# backend/Dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/<entrypoint_package>

FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /server .
EXPOSE 8080
CMD ["./server"]
```

Replace `<entrypoint_package>` with the actual package name found in `backend/cmd/`.

**Step 5** — Verify env variable names match `backend/.env.example` and update accordingly.

---

## 7. Fix Plan: `restart: unless-stopped` on contracts

**File to edit**: `docker-compose.yml` (root)

**What to do**: Until Issue 1 is fixed, change the restart policy on `contracts` to prevent the infinite crash-loop from flooding logs.

**Immediate change** (while Issue 1 is still being fixed):
```yaml
  contracts:
    platform: linux/amd64
    build:
      context: ./contracts
    container_name: fbyt-contracts
    ports:
      - "8899:8899"
      - "8900:8900"
    restart: on-failure:3   # fail fast after 3 attempts instead of looping forever
```

**Restore after Issue 1 is fixed**:
```yaml
    restart: unless-stopped   # restore once anchor localnet starts cleanly
```

---

## 8. Execution Order

Execute the fixes in this order to unblock the stack as fast as possible:

```
Step 1 — Fix Issue 5: change contracts restart policy → on-failure:3
          Stops crash-loop noise immediately

Step 2 — Fix Issue 1: install surfpool in Dockerfile (Option A)
          OR switch to --validator legacy (Option B)
          This is the critical blocker; contracts must start before anything else matters

Step 3 — Fix Issue 4: add anchor-spl Cargo.toml feature correction
          Eliminates warning on next rebuild (5-minute task)

Step 4 — Fix Issue 6: add backend service to root docker-compose.yml
          Completes the full stack

Step 5 — Fix Issue 3: regex_automata stack warning (deferred/optional)
          Only address if tests are actually failing due to stack overflow

Step 6 — Restore: change contracts restart: unless-stopped
          Only after Step 2 is verified clean and contracts stays up
```

---

## 9. Verification Checklist

After applying all fixes, run through these checks in order:

```bash
# 1. Full clean rebuild
docker compose down -v
docker compose build --no-cache

# 2. Start all services
docker compose up -d

# 3. Check all containers are running (not "restarting")
docker compose ps
# Expected: All services show Status=running or Status=healthy
#           None show "restarting"

# 4. Verify contracts node is alive and accepting RPC
curl http://localhost:8899 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
# Expected: {"result":"ok",...}

# 5. Verify contracts program is deployed
curl http://localhost:8899 \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais",{"encoding":"base64"}]}'
# Expected: result.value.executable == true

# 6. Verify TimescaleDB is healthy
docker exec fbyt-timescaledb pg_isready -U postgres -d fbyt
# Expected: /var/run/postgresql:5432 - accepting connections

# 7. Verify PgBouncer is routing correctly
docker exec fbyt-pgbouncer pg_isready -h 127.0.0.1 -p 6432
# Expected: 127.0.0.1:6432 - accepting connections

# 8. Verify Redis
docker exec fbyt-redis redis-cli ping
# Expected: PONG

# 9. Verify frontend is reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200

# 10. Verify backend API (after Issue 6 is fixed)
curl http://localhost:8080/health
# Expected: 200 OK

# 11. Check contracts logs are clean (no crash-loop)
docker compose logs --tail=50 contracts
# Expected: "Localnet running" or similar; no repeated "Failed to spawn surfpool" errors
```

---

## Files Affected Summary

| File | Change | Issue |
|------|--------|-------|
| `contracts/Dockerfile` | Add surfpool install step OR update CMD to `--validator legacy` | 1 |
| `contracts/Anchor.toml` | Add `validator = "legacy"` under `[features]` (Option B only) | 1 |
| `contracts/programs/fbyt-clone-vault/Cargo.toml` | Remove `features = ["idl-build"]` from `anchor-spl` dep | 2 |
| `contracts/programs/fbyt-clone-vault/Cargo.toml` | Optionally bump `litesvm` version | 3 |
| `docker-compose.yml` | Change `contracts` restart policy; add `backend` service block | 5, 6, 7 |
| `backend/Dockerfile` | Create if missing, for the Go API service | 6 |
