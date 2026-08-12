import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { cn } from '../src/lib/utils'

describe('cn', () => {
  it('joins class names', () => {
    assert.equal(cn('flex', 'items-center', 'gap-2'), 'flex items-center gap-2')
  })

  it('ignores false, null, and undefined values', () => {
    assert.equal(cn('block', false, null, undefined, 'rounded'), 'block rounded')
  })

  it('supports conditional object and nested array inputs', () => {
    assert.equal(cn({ hidden: false, flex: true }, ['p-2', ['font-bold']]), 'flex p-2 font-bold')
  })

  it('resolves conflicting Tailwind utility classes in favor of the last value', () => {
    assert.equal(cn('px-2 py-1', 'px-6'), 'py-1 px-6')
  })

  it('keeps non-conflicting responsive and state variants', () => {
    assert.equal(cn('text-sm md:text-base', 'hover:text-red-500'), 'text-sm md:text-base hover:text-red-500')
  })
})
