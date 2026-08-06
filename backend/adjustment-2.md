# Backend Comprehensive Test Plan & Security Audit

> **Posture**: Every test suite below is written from two perspectives:
> 1. **QA Engineer** — correctness, edge cases, boundary values, error paths
> 2. **Hacker / Penetration Tester** — abuse, injection, auth bypass, data exfiltration, DoS

---

## Table of Contents

1. [Auth — Nonce & Verify](#1-auth)
2. [Vault Endpoints](#2-vault-endpoints)
3. [Trade Endpoints](#3-trade-endpoints)
4. [Sync Endpoints](#4-sync-endpoints)
5. [Portfolio Endpoints](#5-portfolio-endpoints)
6. [Metrics Series Endpoints](#6-metrics-series-endpoints)
7. [Transaction Simulate Endpoint](#7-transaction-simulate-endpoint)
8. [WebSocket Handler](#8-websocket-handler)
9. [Health Endpoints](#9-health-endpoints)
10. [Middleware: Auth JWT](#10-middleware-auth-jwt)
11. [Middleware: Rate Limiter](#11-middleware-rate-limiter)
12. [Middleware: CORS](#12-middleware-cors)
13. [Middleware: Security Headers](#13-middleware-security-headers)
14. [Repository Layer](#14-repository-layer)
15. [Config Layer](#15-config-layer)
16. [Cache Invalidation](#16-cache-invalidation)
17. [Global Security Hardening Gaps](#17-global-security-hardening-gaps)
18. [Implementation Order](#18-implementation-order)

---

## 1. Auth

### File: `internal/handlers/auth_handler_test.go`

#### 1.1 POST /api/v1/auth/nonce

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `Nonce_HappyPath` | Valid wallet address | 200, nonce contains prefix |
| E | `Nonce_MissingWalletAddress` | `{}` | 400 |
| E | `Nonce_EmptyWalletAddress` | `{"wallet_address":""}` | 400 |
| E | `Nonce_WhitespaceOnlyAddress` | `{"wallet_address":"   "}` | 400 |
| E | `Nonce_MalformedJSON` | `{bad json` | 400 |
| E | `Nonce_WalletAddressExceedsMaxLength` | 10000-char address | Should reject or not panic |
| S | `Nonce_SQLInjectionInWalletAddress` | `"' OR 1=1--"` | 200, no SQL leak (GORM parameterized) |
| S | `Nonce_XSSInWalletAddress` | `"<script>alert(1)</script>"` | 200, no HTML reflection |
| S | `Nonce_NullByteInAddress` | `"addr\x00evil"` | Must not crash or truncate |
| S | `Nonce_UnicodeHomoglyphAddress` | Cyrillic a in "admin" | Accepted as-is |
| S | `Nonce_HighVolumeRequests` | 10 rapid requests same address | Nonce overwritten each time |
| B | `Nonce_EntropyCheck` | Call 10x | Each nonce must be unique |
| B | `Nonce_NotPredictable` | Call 2x | Nonces must differ |

**Bug**: No Solana base58 pubkey format validation (44 chars). 1-char wallet addresses accepted.

#### 1.2 POST /api/v1/auth/verify

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `Verify_HappyPath` | Valid ed25519 sig over nonce | 200, JWT returned |
| E | `Verify_MissingBothFields` | `{}` | 400 |
| E | `Verify_MissingSignature` | wallet only | 400 |
| E | `Verify_MissingWallet` | signature only | 400 |
| E | `Verify_WalletNotFound` | Nonce never requested | 401 "nonce not requested" |
| E | `Verify_NonceAlreadyConsumed` | Nonce already used | 401 "nonce already consumed" |
| E | `Verify_InvalidBase58Pubkey` | `"wallet_address":"NOT_BASE58!!"` | 400 "invalid wallet address" |
| E | `Verify_PubkeyWrongLength` | Valid base58 but != 32 bytes | 400 |
| E | `Verify_InvalidBase64Signature` | `"signature":"!!!notbase64!!!"` | 400 |
| E | `Verify_SignatureTooShort` | Sig decodes to <64 bytes | 400 |
| E | `Verify_SignatureTooLong` | Sig decodes to >64 bytes | 400 |
| E | `Verify_CorrectFormatWrongKey` | Sig from different key pair | 401 |
| E | `Verify_SignatureOverWrongMessage` | Sig over wrong message | 401 |
| S | `Verify_ReplayAttack` | Same sig used twice | 2nd call → 401 (nonce cleared) |
| S | `Verify_BruteForceSignature` | 1000 random signatures | All 401 (rate limited) |
| S | `Verify_JWTDoesNotExposeSecret` | Decode returned JWT | alg=HS256, no secret in payload |
| S | `Verify_JWTExpiresIn24h` | Parse exp claim | exp = iat + 86400 |
| S | `Verify_JWTContainsWalletAddress` | Parse JWT | wallet_address claim matches |
| S | `Verify_NonceForDifferentWallet` | Sig from wallet A used for B nonce | 400/401 |

---

## 2. Vault Endpoints

### File: `internal/handlers/vault_handler_test.go`

#### 2.1 GET /api/v1/vaults

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `ListVaults_DefaultPagination` | No params | 200, page=1, limit=20 |
| H | `ListVaults_StatusFilter` | `?status=Fundraising` | 200, filtered results |
| H | `ListVaults_EmptyDB` | Empty DB | 200, items=[], total=0 |
| E | `ListVaults_NegativePage` | `?page=-5` | Clamped to 1 |
| E | `ListVaults_ZeroPage` | `?page=0` | Clamped to 1 |
| E | `ListVaults_PageOver10000` | `?page=99999` | Clamped to 10000 |
| E | `ListVaults_LimitZero` | `?limit=0` | Defaults to 20 |
| E | `ListVaults_LimitOver100` | `?limit=9999` | Clamped to 20 |
| E | `ListVaults_LimitNegative` | `?limit=-1` | Defaults to 20 |
| E | `ListVaults_NonIntegerPage` | `?page=abc` | Defaults to 1 |
| S | `ListVaults_SQLInjectionInStatus` | `?status='; DROP TABLE vaults;--` | 200, no crash |
| S | `ListVaults_LargeStatusParam` | 10000-char status string | No panic |

#### 2.2 GET /api/v1/vaults/:address

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `GetVault_HappyPath` | Existing address | 200 with data |
| E | `GetVault_NotFound` | Non-existent | 404 |
| S | `GetVault_SQLInjection` | `' OR 1=1--` as address | 404 or 200 valid; no SQL error |
| S | `GetVault_PathTraversal` | `/../../../etc/passwd` | 404 |
| S | `GetVault_XSSInAddress` | `<img src=x onerror=alert(1)>` | 404 or escaped JSON |

#### 2.3 GET /api/v1/vaults/:address/balances

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `GetVaultBalances_ByAddress` | Valid address, TVL=1000 | SOL=4.667, USDC=300 |
| H | `GetVaultBalances_ByUUID` | Valid UUID | 200 |
| H | `GetVaultBalances_ZeroTVL` | TVL=0 | All amounts=0 |
| E | `GetVaultBalances_NotFound` | Non-existent | 404 |
| B | `GetVaultBalances_Determinism` | Same vault, twice | Identical response |
| B | `GetVaultBalances_HardcodedSOLPrice` | TVL=150 | SOL amount=0.7 (150*0.7/150=0.7) |

**Known limitation**: SOL price hardcoded at $150.0 — must replace with live feed.

#### 2.4 PATCH /api/v1/vaults/:address (auth required)

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `UpdateMetadata_HappyPath` | Manager JWT + valid fields | 200 |
| H | `UpdateMetadata_OnlyDisplayName` | `{"display_name":"New"}` | 200 |
| H | `UpdateMetadata_OnlyDescription` | `{"description":"Desc"}` | 200 |
| H | `UpdateMetadata_OnlyFocusAssets` | `{"focus_assets":["SOL"]}` | 200 |
| H | `UpdateMetadata_AllFields` | All three | 200 |
| E | `UpdateMetadata_NoAuth` | No Authorization | 401 |
| E | `UpdateMetadata_ExpiredToken` | Expired JWT | 401 |
| E | `UpdateMetadata_WrongSigningAlg` | RS256 token | 401 |
| E | `UpdateMetadata_NonManagerToken` | Different wallet JWT | 403 |
| E | `UpdateMetadata_VaultNotFound` | Non-existent | 404 |
| E | `UpdateMetadata_NoFieldsProvided` | `{}` | 400 "No fields to update" |
| E | `UpdateMetadata_NullFields` | `{"display_name":null}` | 400 |
| E | `UpdateMetadata_InvalidFocusAsset` | `{"focus_assets":["UNKNOWN"]}` | 400 (whitelist) |
| S | `UpdateMetadata_XSSInDisplayName` | `{"display_name":"<script>"}` | 200, stored safely |
| S | `UpdateMetadata_SQLInjectionInDisplayName` | `'; DROP TABLE;--` | 200, stored safely |
| S | `UpdateMetadata_MassiveDisplayName` | 100KB value | Truncate or 400 |
| S | `UpdateMetadata_IDORAttempt` | Manager of A tries vault B | 403 |
| S | `UpdateMetadata_AuthHeaderNoBearer` | `Authorization: rawtoken` | 401 |
| S | `UpdateMetadata_BearerEmpty` | `Authorization: Bearer ` | 401 |

---

## 3. Trade Endpoints

### File: `internal/handlers/trade_handler_test.go`

#### 3.1 GET /api/v1/vaults/:address/trades

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `GetTrades_HappyPath` | Vault with trades | 200, list |
| H | `GetTrades_FilterByType` | `?type=Deposit` | Only Deposits |
| H | `GetTrades_EmptyVault` | No trades | 200, empty, total=0 |
| H | `GetTrades_Pagination` | `?page=2&limit=5` | Correct offset |
| E | `GetTrades_VaultNotFound` | Non-existent | 404 |
| E | `GetTrades_NegativePage` | `?page=-1` | Clamped to 1 |
| E | `GetTrades_LimitOver100` | `?limit=200` | Clamped to 20 |
| S | `GetTrades_SQLInjectionInType` | `?type='; DROP TABLE--` | 200, empty (parameterized) |
| B | `GetTrades_ExecutedAtFormat` | Check JSON | `executed_at` is "2006-01-02T15:04:05Z" |

#### 3.2 GET /api/v1/vaults/trades (batch)

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `GetBatchTrades_ArraySyntax` | `?vaultIds[]=id1&vaultIds[]=id2` | 200, both vaults |
| H | `GetBatchTrades_CommaSyntax` | `?vaultIds=id1,id2` | 200 |
| H | `GetBatchTrades_SingleVault` | `?vaultIds[]=id1` | 200 |
| H | `GetBatchTrades_NoVaultIDs` | No param | 200, empty |
| H | `GetBatchTrades_FilterByType` | `?vaultIds[]=id1&type=Withdraw` | Only Withdraws |
| E | `GetBatchTrades_EmptyVaultIDString` | `?vaultIds[]=` | Filtered out |
| E | `GetBatchTrades_WhitespaceVaultID` | `?vaultIds[]=%20` | Filtered out |
| S | `GetBatchTrades_TooManyVaultIDs` | 1000 vault IDs | 400 — must cap at 50 |
| S | `GetBatchTrades_SQLInjectionInVaultID` | `'; DROP TABLE--` | 200, no crash |
| S | `GetBatchTrades_DuplicateVaultIDs` | Same ID twice | Not duplicated in result |

**Known Gap**: No upper bound on number of vaultIDs — must cap at 50.

---

## 4. Sync Endpoints

### File: `internal/handlers/sync_handler_test.go` (NEW)

#### 4.1 POST /api/v1/vaults/sync (auth required)

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `SyncVault_HappyPath` | Valid sig + initialize_vault ix | 200, vault created |
| H | `SyncVault_AlreadyExists` | Same vault twice | 200, existing returned (idempotent) |
| E | `SyncVault_NoAuth` | No JWT | 401 |
| E | `SyncVault_MissingSignature` | No signature field | 400 |
| E | `SyncVault_MissingManagerAddress` | No manager_address | 400 |
| E | `SyncVault_TransactionFailedOnChain` | Mocked Success=false | 400 |
| E | `SyncVault_NoInitializeVaultInstruction` | Wrong ix type | 400 |
| E | `SyncVault_RPCDown` | RPC error | 500 |
| S | `SyncVault_ManagerAddressSpoofing` | JWT wallet=A, body manager=B | Must 403 — CURRENTLY BROKEN |
| S | `SyncVault_ForgedTransaction` | Wrong program ID | Must reject |
| S | `SyncVault_ReplayAttack` | Same sig twice | 2nd returns existing vault |

**[CRITICAL BUG]**: `req.ManagerAddress` from body is trusted without verifying it matches the JWT.
Fix: `if req.ManagerAddress != jwtWalletAddress { return 403 }`

#### 4.2 POST /api/v1/trades/sync (auth required)

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `SyncTrade_Deposit_HappyPath` | Valid deposit tx | 200, trade+portfolio created |
| H | `SyncTrade_Withdraw_HappyPath` | Valid withdraw tx | 200, position reduced |
| H | `SyncTrade_Buy_HappyPath` | Valid buy tx | 200 |
| H | `SyncTrade_DuplicateSignature` | Same sig twice | 409 "already synced" |
| E | `SyncTrade_NoAuth` | No JWT | 401 |
| E | `SyncTrade_MissingSignature` | No sig field | 400 |
| E | `SyncTrade_MissingVaultID` | No vault_id | 400 |
| E | `SyncTrade_VaultNotFound` | Bad vault_id | 404 |
| E | `SyncTrade_TransactionFailedOnChain` | Mocked fail | 400 |
| E | `SyncTrade_NoRecognizedInstruction` | Unknown ix | 400 |
| E | `SyncTrade_RPCDown` | RPC timeout | 500 |
| S | `SyncTrade_SignerMismatch` | JWT=A, tx.Signer=B | Must 403 — CURRENTLY BROKEN |
| S | `SyncTrade_RaceConditionDuplicate` | Two concurrent requests same sig | Only one succeeds |
| S | `SyncTrade_AmountZeroDeposit` | amount=0 | Reject or handle gracefully |
| S | `SyncTrade_WithdrawMoreThanOwned` | Withdraw > portfolio | "insufficient shares" |
| S | `SyncTrade_Atomicity` | Trade insert OK, portfolio fails | Entire tx rolled back |

**[CRITICAL BUG]**: `parsed.Signer` not verified against JWT `wallet_address`. Attacker can sync anyone's trade.
Fix: `if parsed.Signer != jwtWalletAddress { return 403 }`

---

## 5. Portfolio Endpoints

### File: `internal/handlers/portfolio_handler_test.go` (NEW)

#### 5.1 GET /api/v1/portfolio/:wallet

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `GetPortfolio_HappyPath` | Existing wallet with positions | 200, positions list |
| H | `GetPortfolio_EmptyPortfolio` | Wallet exists, no trades | 200, empty |
| E | `GetPortfolio_WalletNotFound` | Non-existent | 404 |
| S | `GetPortfolio_IDOR_PublicEndpoint` | Victim's wallet | 200 — intentionally public, document |
| S | `GetPortfolio_SQLInjection` | `'; DROP TABLE users;--` | 404 or 200, parameterized |
| B | `GetPortfolio_UUIDInvalidUserID` | DB user with malformed UUID | 500 graceful |
| B | `GetPortfolio_PnLCalculation` | Known values | pnl = currentValue - totalInvested |
| B | `GetPortfolio_CurrentValueWhenTVLZero` | TVL=0 | currentValue=0, pnl negative |

---

## 6. Metrics Series Endpoints

### File: `internal/handlers/metrics_handler_test.go`

#### 6.1 GET /api/v1/metrics/series

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `GetMetrics_TVL_7d` | `?metric=tvl&period=7d` | 200, series |
| H | `GetMetrics_TVL_14d` | `?metric=tvl&period=14d` | 200 |
| H | `GetMetrics_TVL_30d_Default` | `?metric=tvl` | 200, defaults to 30d |
| H | `GetMetrics_AllMetrics` | tvl,invested,pnl,fees,volume | All 200 |
| H | `GetMetrics_WithVaultID` | `?metric=tvl&vault_id=<uuid>` | Filtered by vault |
| H | `GetMetrics_EmptySeries` | No history | 200, series=[] |
| E | `GetMetrics_MissingMetric` | `?period=7d` only | 400 |
| E | `GetMetrics_InvalidMetric` | `?metric=unknown` | 400 |
| E | `GetMetrics_InvalidPeriod` | `?metric=tvl&period=60d` | 400 |
| E | `GetMetrics_InvalidPeriodValue` | `?period=abc` | 400 |
| E | `GetMetrics_EmptyMetric` | `?metric=` | 400 |
| S | `GetMetrics_SQLInjectionInMetric` | `?metric=tvl'; DROP TABLE--` | 400 (whitelist before repo) |
| S | `GetMetrics_SQLInjectionInVaultID` | `?vault_id='; DELETE FROM` | Parameterized, no crash |
| S | `GetMetrics_NilRepoSafeguard` | metricsRepo=nil | 500, not panic |
| B | `GetMetrics_SummaryMath` | Seeded known values | Verify peak/low/avg/delta |
| B | `GetMetrics_SeriesDateFormat` | Check series | Each date is "YYYY-MM-DD" |
| B | `GetMetrics_SeriesOrdering` | Multiple points | Sorted ASC |

---

## 7. Transaction Simulate Endpoint

### File: `internal/handlers/transaction_handler_test.go`

#### 7.1 POST /api/v1/transactions/simulate

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `Simulate_HappyPath` | Valid body | 200, signature+explorerUrl+status |
| H | `Simulate_Determinism` | Same inputs twice | Identical signature |
| H | `Simulate_DifferentAction` | Same vault/user, different action | Different signature |
| H | `Simulate_DifferentUser` | Same vault/action, different user | Different signature |
| H | `Simulate_SignatureLength` | Any valid input | 87 or 88 chars |
| H | `Simulate_ExplorerURL` | Any input | Starts with "https://solscan.io/tx/" |
| E | `Simulate_EmptyBody` | `{}` | 200 (no required fields) |
| E | `Simulate_MalformedJSON` | `{bad` | 400 |
| S | `Simulate_NoAuthRequired` | No JWT | 200 (intentional for dev) |
| S | `Simulate_SignatureIsBase58` | Check output | Valid base58 chars only |
| S | `Simulate_SignatureUnique` | 100 different inputs | All differ |
| B | `Simulate_AmountNotInSignature` | Same vault/user/action, diff amounts | Same sig (known design limitation) |

---

## 8. WebSocket Handler

### File: `internal/handlers/ws_handler_test.go`

| # | Test Name | Input | Expected |
|---|-----------|-------|----------|
| H | `WS_ConnectWithQueryToken` | `?token=<valid_jwt>` | 101 Upgrade |
| H | `WS_ConnectWithJWTParam` | `?jwt=<valid_jwt>` | 101 Upgrade |
| H | `WS_ConnectWithAccessToken` | `?access_token=<valid_jwt>` | 101 Upgrade |
| H | `WS_ConnectWithBearerHeader` | `Authorization: Bearer <jwt>` | 101 Upgrade |
| E | `WS_NoToken` | No token | 401 |
| E | `WS_ExpiredToken` | Expired JWT | 401 |
| E | `WS_InvalidToken` | `?token=garbage` | 401 |
| E | `WS_WrongAlgorithm` | RS256-signed JWT | 401 |
| E | `WS_DisallowedOrigin` | Origin: http://evil.com | 403 |
| E | `WS_EmptyOriginAllowed` | No Origin header | Currently allowed — document risk |
| S | `WS_TokenInURL_LogLeak` | `?token=<jwt>` | Token visible in access logs — known risk |
| S | `WS_ConnectionFlood` | 1000 concurrent connects | No crash |
| S | `WS_MessageFlood` | Valid conn, 10000 msgs | No OOM |
| S | `WS_AlgorithmNone` | alg=none JWT | 401 |
| B | `WS_CorrectPath` | `/api/v1/ws` | 101 |
| B | `WS_RootPathReturns404` | `/ws` | 404 — FE must use /api/v1/ws |

---

## 9. Health Endpoints

### File: `internal/handlers/health_test.go`

| # | Test Name | Expected |
|---|-----------|----------|
| H | `Health_AllUp` | 200, db=ok, redis=ok |
| H | `Health_DBDown` | 503, db=down |
| H | `Health_RedisDown` | 503, redis=down |
| H | `Health_BothDown` | 503 |
| H | `Liveness_AlwaysOK` | 200, status=alive |
| H | `Readiness_DelegatesToHealth` | Same as health |
| S | `Health_NoSensitiveInfo` | Check body | No DB URL or secrets in response |

---

## 10. Middleware: Auth JWT

### File: `internal/middleware/auth_test.go`

| # | Test Name | Expected |
|---|-----------|----------|
| H | `AuthMW_ValidToken` | Passes, wallet_address in context |
| E | `AuthMW_NoHeader` | 401 "missing authorization header" |
| E | `AuthMW_InvalidFormat_NoBearer` | 401 "invalid authorization format" |
| E | `AuthMW_ExpiredToken` | 401 |
| E | `AuthMW_WrongSecret` | 401 |
| E | `AuthMW_TamperedPayload` | Modified payload, same sig | 401 |
| S | `AuthMW_AlgNone` | `{"alg":"none"}` JWT | 401 |
| S | `AuthMW_RS256Token` | RS256-signed token | 401 |
| S | `AuthMW_EmptyToken` | `Authorization: Bearer ` | 401 |
| B | `GenerateToken_RoundTrip` | Generate then validate | Claims match |
| B | `ValidateToken_WalletAddressPreserved` | Any wallet | Claim preserved exactly |
| B | `VerifySignature_ValidHex` | Known key pair | Returns true |
| B | `VerifySignature_WrongLength` | Truncated pubkey | Returns false |

---

## 11. Middleware: Rate Limiter

### File: `internal/middleware/ratelimit_test.go`

| # | Test Name | Expected |
|---|-----------|----------|
| H | `RateLimit_AllowUnderLimit` | 5 requests in 1min | All 200 |
| H | `RateLimit_Block6thRequest` | 6th request same IP | 429, Retry-After: 60 |
| H | `RateLimit_DifferentIPsIndependent` | IP1 hits limit, IP2 ok | IP2 → 200 |
| H | `RateLimit_Recover` | Wait for refill | Subsequent pass |
| E | `RateLimit_ZeroRate` | `NewIPRateLimiter(0, time.Minute)` | Clamped to 1 |
| E | `RateLimit_NegativePeriod` | Negative duration | Clamped to time.Second |
| S | `RateLimit_IPSpoofingXForwardedFor` | X-Forwarded-For header | Test if ClientIP() trusts it |
| S | `RateLimit_IPv6` | IPv6 client | Correctly rate-limited |
| S | `RateLimit_MemoryGrowth` | 100000 unique IPs | Map grows unbounded — DoS risk |

**[HIGH] Critical Gap**: `IPRateLimiter.limiters` has NO eviction. 100k unique IPs → OOM crash. Must use TTL-based eviction or Redis.

---

## 12. Middleware: CORS

### File: `internal/middleware/cors_test.go` (NEW)

| # | Test Name | Expected |
|---|-----------|----------|
| H | `CORS_AllowedOrigin` | localhost:3000 | ACAO header set |
| H | `CORS_PreflightOptions` | OPTIONS | 204 |
| H | `CORS_NonCORSRequest` | No Origin | Passes through |
| E | `CORS_UnknownOrigin` | evil.com | No ACAO header |
| S | `CORS_WildcardNotUsed` | Check response | Never returns `*` |
| S | `CORS_NullOriginBypass` | `Origin: null` | Must not be in allowed list |
| B | `CORS_BothPortsAllowed` | 3000 and 5173 | Both independently allowed |

---

## 13. Middleware: Security Headers

### File: `internal/middleware/security_test.go` (NEW)

| # | Test Name | Expected |
|---|-----------|----------|
| H | `SecurityHeaders_AllPresent` | Any request | Three headers present |
| B | `SecurityHeaders_ContentTypeOptions` | Value | `nosniff` |
| B | `SecurityHeaders_FrameOptions` | Value | `DENY` |
| B | `SecurityHeaders_XSSProtection` | Value | `0` |
| S | `SecurityHeaders_MissingCSP` | Check | No CSP header — document gap |
| S | `SecurityHeaders_MissingHSTS` | Check | No HSTS header — document gap |
| S | `SecurityHeaders_MissingPermissionsPolicy` | Check | No Permissions-Policy — document gap |

---

## 14. Repository Layer

### 14.1 VaultRepository

| # | Test Name | Expected |
|---|-----------|----------|
| H | `CreateVault_HappyPath` | ID populated |
| H | `GetByAddress_Found` | Full detail |
| H | `GetByAddress_NotFound` | ErrNotFound |
| H | `GetByID_ValidUUID` | Found |
| H | `GetByID_InvalidUUID` | ErrNotFound (parse fails) |
| H | `GetByID_NotFound` | ErrNotFound |
| H | `ExistsByAddress_True` | true |
| H | `ExistsByAddress_False` | false |
| H | `UpdateMetadata_MergesExisting` | Existing meta preserved |
| H | `List_Paginated` | Correct offset |
| H | `List_StatusFilter` | Filters correctly |
| H | `GetVaultBalances_ByAddress` | Correct split |
| H | `GetVaultBalances_ByUUID` | Resolves correctly |
| H | `GetVaultBalances_NotFound` | ErrNotFound |
| E | `GetVaultBalances_ZeroTVL` | SOL=0, USDC=0 |
| B | `TradeCount_Correct` | 3 trades → TradeCount=3 |
| B | `PortfolioCount_Correct` | 2 holders → PortfolioCount=2 |

### 14.2 TradeRepository

| # | Test Name | Expected |
|---|-----------|----------|
| H | `FindBySignature_Found` | Returns trade |
| H | `FindBySignature_NotFound` | ErrNotFound |
| H | `Create_HappyPath` | ID populated |
| H | `Create_DuplicateSignature` | Unique constraint error |
| H | `ListByVault_Paginated` | Correct offset, DESC order |
| H | `ListByVault_TypeFilter` | Only matching type |
| H | `ListByVaultIDs_MultipleVaults` | Both vaults' trades |
| H | `ListByVaultIDs_EmptySlice` | Returns all |
| H | `ListByVaultIDs_MixedUUIDAndString` | Both handled |
| E | `ListByVaultIDs_InvalidUUIDs` | No crash |
| B | `ListByVaultIDs_NoDuplicates` | Duplicate IDs → no duplicate rows |

### 14.3 PortfolioRepository (NEW)

| # | Test Name | Expected |
|---|-----------|----------|
| H | `UpsertPosition_Create` | New position created |
| H | `UpsertPosition_Update` | Shares accumulate |
| H | `UpsertPosition_AvgPriceCalculation` | Weighted avg correct |
| H | `ReducePosition_HappyPath` | Proportional reduction |
| H | `ReducePosition_NotFound` | ErrNotFound |
| E | `ReducePosition_InsufficientShares` | "insufficient shares" |
| E | `ReducePosition_ZeroShares` | No-op or error |
| B | `UpsertPosition_NoNegativeShares` | Decimal arithmetic clean |
| B | `GetTotalSharesByVault_SumsAll` | 3 holders → sum |
| B | `GetHolderUserIDs_ReturnsDistinct` | No duplicates |

### 14.4 MetricsRepository

| # | Test Name | Expected |
|---|-----------|----------|
| H | `GetMetricSeries_TVL_7d` | Uses vault_metrics |
| H | `GetMetricSeries_FallbackToPriceHistory` | When vault_metrics empty |
| H | `GetMetricSeries_FallbackToSinglePoint` | No price_history either |
| H | `GetMetricSeries_Volume` | Uses price_history |
| H | `GetMetricSeries_PnL` | Uses trade_histories |
| H | `GetMetricSeries_Invested` | Uses deposit trades |
| H | `GetMetricSeries_Fees` | Uses fee trades |
| E | `GetMetricSeries_InvalidMetric` | ErrInvalidInput |
| E | `GetMetricSeries_InvalidPeriod` | ErrInvalidInput |
| B | `CalculateSummary_AllZeros` | Empty → all zeros |
| B | `CalculateSummary_SinglePoint` | NetChange=0, PctChange=0 |
| B | `CalculateSummary_ZeroFirstValue` | first=0, last=100 → PctChange=100 |
| B | `BucketQueryResult_NoGORMParseError` | Scan succeeds without error log |

---

## 15. Config Layer

### File: `internal/config/config_test.go`

| # | Test Name | Expected |
|---|-----------|----------|
| H | `Config_AllEnvSet` | All fields populated |
| E | `Config_MissingDatabaseURL` | Error |
| E | `Config_JWTSecretTooShort` | Error (< 32 bytes) |
| E | `Config_JWTSecretExactly31Chars` | Error |
| H | `Config_JWTSecretExactly32Chars` | OK |
| H | `Config_JWTSecretOver32Chars` | OK |
| H | `Config_DefaultPort` | 8080 |
| H | `Config_CustomPort` | 9090 |
| H | `Config_SSLModeDefault` | "disable" |
| H | `Config_SSLModeCustom` | "require" |
| H | `Config_SolanaRPCDefault` | mainnet-beta |
| H | `Config_FocusAssetsWhitelistParsed` | ["SOL","ETH"] |
| H | `Config_FocusAssetsWhitelistTrimmed` | Trimmed spaces |
| H | `Config_DustThresholdDefault` | 0.001 |
| H | `Config_DustThresholdCustom` | 0.005 |
| E | `Config_InvalidDustThreshold` | Falls back to default |
| S | `Config_JWTSecretNotLoggedOnError` | Error msg has no secret value |

---

## 16. Cache Invalidation

### File: `internal/handlers/cache_invalidation_test.go`

| # | Test Name | Expected |
|---|-----------|----------|
| H | `InvalidateLeaderboard_WithCache` | Delete called |
| H | `InvalidateLeaderboard_NilCache` | No panic |
| H | `InvalidateVaultSummary_WithCache` | Delete called |
| H | `InvalidateVaultSummary_NilCache` | No panic |
| H | `InvalidateVaultPortfolio_WithHolders` | Each holder's keys deleted |
| H | `InvalidateVaultPortfolio_NilCache` | No panic |
| H | `InvalidateVaultPortfolio_NilRepo` | No panic |
| H | `InvalidateUserCache_ValidUserID` | Portfolio and PnL keys deleted |
| E | `InvalidateUserCache_InvalidUUID` | Skipped gracefully |
| B | `CacheKey_Uniqueness` | Different vaults → different keys |

---

## 17. Global Security Hardening Gaps

### [CRITICAL] #1 — SyncVault Manager Address Spoofing
- **Location**: `sync_handler.go:122`
- **Attack**: Send `manager_address: victim_wallet` → victim becomes vault manager
- **Fix**: `assert req.ManagerAddress == JWT.WalletAddress`
- **Test**: `SyncVault_ManagerAddressMismatch_Returns403`

### [CRITICAL] #2 — SyncTrade Signer Not Verified Against JWT
- **Location**: `sync_handler.go:215`
- **Attack**: Valid JWT holder syncs another user's on-chain trade into their portfolio
- **Fix**: `assert parsed.Signer == JWT.WalletAddress`
- **Test**: `SyncTrade_SignerJWTMismatch_Returns403`

### [HIGH] #3 — Rate Limiter Memory Exhaustion (No Eviction)
- **Location**: `ratelimit.go:14` — `limiters map[string]*rate.Limiter` grows forever
- **Attack**: Rotate source IPs → OOM crash (attackable from botnet)
- **Fix**: Replace with go-cache/ristretto with TTL or Redis-backed limiter
- **Test**: `RateLimit_MemoryGrowthBounded`

### [HIGH] #4 — No Wallet Address Format Validation
- **Location**: `auth_handler.go:62`, `sync_handler.go`
- **Attack**: 1MB wallet strings → high per-request allocation
- **Fix**: Validate Solana base58 pubkey (must be 43-44 chars, valid base58)
- **Test**: `Nonce_OversizedWalletAddress_Returns400`

### [HIGH] #5 — Batch Trades: No Cap on vaultIDs
- **Location**: `trade_handler.go:131`
- **Attack**: 10000 vault IDs → massive SQL IN clause → DB timeout/DoS
- **Fix**: Cap at 50 IDs, return 400 if exceeded
- **Test**: `GetBatchTrades_Over50VaultIDs_Returns400`

### [MEDIUM] #6 — WebSocket JWT Token in URL Query String
- **Location**: `ws_handler.go:47-53`
- **Attack**: Token logged in access logs, Referer, browser history
- **Recommendation**: Prefer Authorization header; use short-lived one-time connect tokens
- **Test**: `WS_TokenInQueryStringLogged_DocumentedRisk`

### [MEDIUM] #7 — Missing Content-Security-Policy Header
- **Location**: `security.go`
- **Fix**: Add `Content-Security-Policy: default-src 'none'` for API responses
- **Test**: `SecurityHeaders_CSP_Present`

### [MEDIUM] #8 — CORS: Empty Origin Bypasses Check
- **Location**: `ws_handler.go:29` — `return origin == ""`
- **Risk**: Server-side/scripted requests bypass origin check on WS
- **Test**: `WS_EmptyOrigin_AllowedByDefault_Documented`

### [LOW] #9 — /transactions/simulate Has No Auth (By Design)
- **Risk**: Signature enumeration for dev testing; acceptable in dev, must be disabled in prod
- **Test**: `Simulate_NoAuth_Documented_DevOnly`

### [LOW] #10 — Portfolio Endpoint Is Fully Public (IDOR by Design)
- **Risk**: Any wallet's holdings visible to anyone
- **Test**: `Portfolio_PublicAccess_Documented`

### [LOW] #11 — Hardcoded SOL Price in GetVaultBalances
- **Location**: `vault_repo.go:149` — `solPrice := decimal.NewFromFloat(150.0)`
- **Risk**: Stale price → wrong USD values, potential financial reporting inaccuracy
- **Test**: `GetVaultBalances_SOLPriceIsHardcoded_Documented`

---

## 18. Implementation Order

```
P0 — Security Fixes (write tests FIRST, then fix code)
  1. SyncVault_ManagerAddressMismatch_Returns403     [CRITICAL]
  2. SyncTrade_SignerJWTMismatch_Returns403           [CRITICAL]
  3. RateLimit_MemoryGrowthBounded                   [HIGH]
  4. GetBatchTrades_Over50VaultIDs_Returns400         [HIGH]
  5. Nonce_OversizedWalletAddress_Returns400          [HIGH]

P1 — New Test Files
  6. internal/handlers/sync_handler_test.go           (entirely new)
  7. internal/handlers/portfolio_handler_test.go      (entirely new)
  8. internal/middleware/cors_test.go                 (entirely new)
  9. internal/middleware/security_test.go             (entirely new)
  10. internal/repository/portfolio_repo_test.go      (entirely new)

P2 — Extend Existing Tests
  11. internal/handlers/auth_handler_test.go
  12. internal/handlers/vault_handler_test.go
  13. internal/handlers/trade_handler_test.go
  14. internal/handlers/metrics_handler_test.go
  15. internal/handlers/transaction_handler_test.go
  16. internal/handlers/ws_handler_test.go
  17. internal/middleware/auth_test.go
  18. internal/middleware/ratelimit_test.go
  19. internal/repository/vault_repo_test.go
  20. internal/repository/trade_repo_test.go
  21. internal/repository/metrics_repo_test.go
  22. internal/config/config_test.go
```

---

## Test Infrastructure Notes

All handler tests use mock repository stubs from `handlers/stubs.go`.
Repository tests use `github.com/glebarez/sqlite` in-memory DB.

Run all tests:
```bash
rtk go test ./...
```

Run with race detector (important for rate limiter + WS concurrency):
```bash
go test -race ./...
```
