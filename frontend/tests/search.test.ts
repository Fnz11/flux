import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSearchQuery,
  computeSuggestionRoute,
  isManagerPair,
  isVaultResult,
} from '../src/lib/search'

describe('buildSearchQuery', () => {
  it('trims leading and trailing whitespace', () => {
    assert.equal(buildSearchQuery('  SOL/USDC  '), 'SOL/USDC')
  })

  it('collapses internal runs of whitespace to a single space', () => {
    assert.equal(buildSearchQuery('alpha\t beta\n gamma'), 'alpha beta gamma')
  })

  it('returns empty string for empty / whitespace-only input', () => {
    assert.equal(buildSearchQuery(''), '')
    assert.equal(buildSearchQuery('   '), '')
  })

  it('leaves single-word queries untouched', () => {
    assert.equal(buildSearchQuery('SOL'), 'SOL')
  })
})

describe('isManagerPair', () => {
  it('returns true for an object with a string symbol', () => {
    assert.equal(isManagerPair({ symbol: 'SOL/USDC' }), true)
  })

  it('returns false for a vault-shaped object', () => {
    assert.equal(isManagerPair({ id: 'v1', displayName: 'V' }), false)
  })

  it('returns false for null, primitives, and symbol-less objects', () => {
    assert.equal(isManagerPair(null), false)
    assert.equal(isManagerPair('SOL'), false)
    assert.equal(isManagerPair({}), false)
  })
})

describe('isVaultResult', () => {
  it('returns true for an object with an id and no symbol', () => {
    assert.equal(isVaultResult({ id: 'v1', address: 'a', displayName: 'V' }), true)
  })

  it('returns false for a pair-shaped object', () => {
    assert.equal(isVaultResult({ symbol: 'SOL/USDC' }), false)
  })

  it('returns false for objects without an id', () => {
    assert.equal(isVaultResult({ displayName: 'V' }), false)
  })
})

describe('computeSuggestionRoute', () => {
  it('manager selecting a pair navigates to /trade', () => {
    assert.equal(computeSuggestionRoute({ symbol: 'BTC/USDC' }, 'manager'), '/trade')
  })

  it('manager with a vault result returns null (no route)', () => {
    assert.equal(
      computeSuggestionRoute({ id: 'v1', address: 'a', displayName: 'V', tvl: 1 }, 'manager'),
      null,
    )
  })

  it('investor selecting a vault navigates to /vaults/:id', () => {
    const vault = { id: 'vault_abc', address: 'VaultPubkey1', displayName: 'Alpha Quant', tvl: 1000 }
    assert.equal(computeSuggestionRoute(vault, 'investor'), '/vaults/vault_abc')
  })

  it('investor with a pair result returns null (no route)', () => {
    assert.equal(computeSuggestionRoute({ symbol: 'SOL/USDC' }, 'investor'), null)
  })

  it('investor selecting a vault with empty id returns null', () => {
    assert.equal(
      computeSuggestionRoute({ id: '', address: 'a', displayName: 'V', tvl: 0 }, 'investor'),
      null,
    )
  })
})
