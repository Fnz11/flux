import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { TOKENS, DEFAULT_WHITELISTED_TOKENS } from '../src/constants/tokens'

describe('TOKENS', () => {
  it('contains the supported tokens in display order', () => {
    assert.deepStrictEqual(
      TOKENS.map((token) => token.symbol),
      [...DEFAULT_WHITELISTED_TOKENS],
    )
  })

  it('uses unique symbols and mint addresses', () => {
    assert.equal(new Set(TOKENS.map((token) => token.symbol)).size, TOKENS.length)
    assert.equal(new Set(TOKENS.map((token) => token.mint)).size, TOKENS.length)
  })

  it('defines expected decimals for SOL and stablecoins', () => {
    assert.equal(TOKENS.find((token) => token.symbol === 'SOL')?.decimals, 9)
    assert.equal(TOKENS.find((token) => token.symbol === 'USDC')?.decimals, 6)
    assert.equal(TOKENS.find((token) => token.symbol === 'USDT')?.decimals, 6)
  })

  it('provides valid display metadata for every token', () => {
    for (const token of TOKENS) {
      assert.ok(token.name.length > 0)
      assert.match(token.color, /^#[0-9A-F]{6}$/i)
      assert.match(token.icon, /^https:\/\//)
      assert.ok(token.mint.length > 30)
    }
  })
})
