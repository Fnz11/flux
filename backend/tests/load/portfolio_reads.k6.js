// Load test: portfolio + vault marketplace read path.
//
// Targets (router.go):
//   GET /api/v1/portfolio/:wallet   -> PortfolioHandler.GetPortfolio (user lookup + preload + share aggregation)
//   GET /api/v1/vaults              -> VaultHandler.ListVaults (count + page query)
//   GET /api/v1/vaults/:address     -> VaultHandler.GetVault (vault + trade/portfolio counts)
//   GET /api/v1/vaults/:address/trades -> TradeHandler.GetTrades (count + ordered page query)
//
// Auth: AuthMiddleware exists in internal/middleware/auth.go but is NOT mounted on
// any route in router.go, so all read endpoints are currently public. If auth is
// wired up later, pass a token: k6 run -e AUTH_TOKEN=... (Bearer header is added).
//
// Usage:
//   k6 run tests/load/portfolio_reads.k6.js
//   k6 run -e BASE_URL=http://localhost:8080 -e WALLETS=addr1,addr2,addr3 \
//          --out json=results/before_portfolio.json tests/load/portfolio_reads.k6.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const VAULTS = (__ENV.VAULTS || '').split(',').map((s) => s.trim()).filter(Boolean);

const headers = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
};

// Deterministic synthetic wallet pool (LCG over base58 alphabet, 44 chars like
// real Solana addresses). Wallets must exist in the DB or these 404 and trip the
// http_req_failed threshold. Override with -e WALLETS=real,addresses for realism
// (see tests/load/README.md for the optional seed SQL).
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function makeWallets(count) {
  const wallets = [];
  let x = 987654321;
  for (let i = 0; i < count; i++) {
    x = (x * 1664525 + 1013904223) % 4294967296;
    let addr = '';
    for (let j = 0; j < 44; j++) {
      x = (x * 1664525 + 1013904223) % 4294967296;
      addr += ALPHABET[x % ALPHABET.length];
    }
    wallets.push(addr);
  }
  return wallets;
}

const WALLETS = new SharedArray('wallets', () =>
  (__ENV.WALLETS || '').split(',').map((s) => s.trim()).filter(Boolean).length > 0
    ? (__ENV.WALLETS || '').split(',').map((s) => s.trim()).filter(Boolean)
    : makeWallets(100)
);

export const options = {
  scenarios: {
    ramping_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '60s', target: 200 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  // NOTE: p(95) < 500ms is an ASPIRATIONAL goal. Pre-optimization runs are
  // expected to miss it (that is the point of a baseline). Do not fail the run
  // because of it; record before/after numbers and judge the delta.
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:portfolio}': ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name:vault_list}': ['p(95)<500'],
    'http_req_duration{name:vault_detail}': ['p(95)<500'],
    'http_req_duration{name:trades}': ['p(95)<500'],
  },
};

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

export default function () {
  const wallet = WALLETS[randomInt(WALLETS.length)];
  const useVaultDetail = VAULTS.length > 0;
  const roll = Math.random();

  if (useVaultDetail && roll < 0.1) {
    const vault = VAULTS[randomInt(VAULTS.length)];
    const res = http.get(`${BASE_URL}/api/v1/vaults/${vault}`, {
      headers,
      tags: { name: 'vault_detail' },
    });
    check(res, {
      'vault detail status is 200': (r) => r.status === 200,
      'vault detail has data.vault': (r) => !!r.json().data && !!r.json().data.vault,
    });
  } else if (useVaultDetail && roll < 0.3) {
    const vault = VAULTS[randomInt(VAULTS.length)];
    const res = http.get(`${BASE_URL}/api/v1/vaults/${vault}/trades?page=1&limit=20`, {
      headers,
      tags: { name: 'trades' },
    });
    check(res, {
      'trades status is 200': (r) => r.status === 200,
      'trades has data.trades array': (r) => Array.isArray(r.json().data && r.json().data.trades),
    });
  } else if (!useVaultDetail && roll < 0.3) {
    const res = http.get(`${BASE_URL}/api/v1/vaults?page=${randomInt(5) + 1}&limit=20`, {
      headers,
      tags: { name: 'vault_list' },
    });
    check(res, {
      'vault list status is 200': (r) => r.status === 200,
      'vault list has data.items array': (r) => Array.isArray(r.json().data && r.json().data.items),
    });
  } else {
    const res = http.get(`${BASE_URL}/api/v1/portfolio/${wallet}`, {
      headers,
      tags: { name: 'portfolio' },
    });
    const body = res.json();
    check(res, {
      'portfolio status is 200': (r) => r.status === 200,
      'portfolio success flag': () => body.success === true,
      'portfolio has data.positions array': () =>
        !!body.data && Array.isArray(body.data.positions),
      'portfolio wallet echoes request': () =>
        !!body.data && body.data.wallet === wallet,
    });
  }

  sleep(0.5 + Math.random() * 1.5);
}
