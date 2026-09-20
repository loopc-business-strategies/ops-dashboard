import { describe, expect, test } from 'vitest'
import { createOperationId } from './outbox'

describe('outbox helpers', () => {
  test('createOperationId is unique-ish', () => {
    const a = createOperationId('metal_in')
    const b = createOperationId('metal_in')
    expect(a).not.toBe(b)
    expect(a.startsWith('metal_in_')).toBe(true)
  })
})
