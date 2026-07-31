// Load test: PNL read path.
//
// There is no dedicated /api/v1/pnl route yet — PNL is computed inside
// PortfolioHandler.GetPortfolio and returned per position as `pnl` and
// `pnl_percent` (internal/handlers/portfolio_handler.go). This script hits
// GET /api/v1/portfolio/:wallet and asserts the PNL fields are present and
// numeric. When a dedicated PNL endpoint lands, point PNL_PATH at it.
//
// Usage:
//   k6 run tests/load/pnl_reads.k6.js
//   k6 run -e BASE_URL=http://localhost:8080 -e WALLETS=wallet1,wallet2 \
//          --out json=results/before_pnl.json tests/load/pnl_reads.k6.js
//
// NOTE: wallets without positions return 200 with an empty positions array, so
// a pool of ANY existing users is fine here. 404s (unknown wallets) trip the
// http_req_failed threshold.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const PNL_PATH = __ENV.PNL_PATH || '/api/v1/portfolio';

const headers = {
  'Content-Type': 'application/json',
  ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
};

// Deterministic synthetic wallet pool (see portfolio_reads.k6.js).
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

const WALLETS = new SharedArray('wallets', () => {
  const fromEnv = (__ENV.WALLETS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : makeWallets(100);
});

export const options = {
  scenarios: {
    ramping_pnl: {
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
    'http_req_duration{name:pnl}': ['p(95)<500', 'p(99)<1000'],
  },
};

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

export default function () {
  const wallet = WALLETS[randomInt(WALLETS.length)];
  const res = http.get(`${BASE_URL}${PNL_PATH}/${wallet}`, {
    headers,
    tags: { name: 'pnl' },
  });

  const body = res.json();
  const positions = body && body.data ? body.data.positions : null;

  check(res, {
    'pnl status is 200': (r) => r.status === 200,
    'pnl success flag': () => body.success === true,
    'pnl has positions array': () => Array.isArray(positions),
    'pnl fields numeric per position': () =>
      !positions ||
      positions.every(
        (p) =>
          typeof p.pnl === 'number' &&
          typeof p.pnl_percent === 'number' &&
          typeof p.current_value === 'number'
      ),
  });

  sleep(0.5 + Math.random() * 1.5);
}
