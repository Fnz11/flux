import { renderHook } from '@testing-library/react'
import { useState } from 'react'
import { expect, it } from 'vitest'

it('uses the renderer React dispatcher', () => {
  const { result } = renderHook(() => useState('ready'))

  expect(result.current[0]).toBe('ready')
})
