import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { formatError } from '../src/lib/errors'

describe('formatError helper', () => {
  it('extracts error message from Error instance', () => {
    const err = new Error('RPC connection timeout')
    assert.equal(formatError(err, 'Fallback'), 'RPC connection timeout')
  })

  it('returns fallback string when err is not an Error instance', () => {
    assert.equal(formatError('string error', 'Default failure'), 'Default failure')
    assert.equal(formatError(null, 'Default failure'), 'Default failure')
    assert.equal(formatError(undefined, 'Default failure'), 'Default failure')
    assert.equal(formatError({ code: 500 }, 'Default failure'), 'Default failure')
  })

  it('supports Error subclasses', () => {
    assert.equal(formatError(new TypeError('Invalid amount'), 'Fallback'), 'Invalid amount')
  })

  it('preserves an empty Error message rather than substituting the fallback', () => {
    assert.equal(formatError(new Error(''), 'Fallback'), '')
  })
})
