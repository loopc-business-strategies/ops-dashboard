import { describe, expect, it } from 'vitest'
import { assertMgOnly, getTenant, MG_TENANT } from './tenant'
import { createOperationId } from '../offline/outbox'

describe('MG Floor tenant lock', () => {
  it('is permanently mg', () => {
    expect(MG_TENANT).toBe('mg')
    expect(getTenant()).toBe('mg')
    expect(assertMgOnly('mg')).toBe(true)
    expect(assertMgOnly('cg')).toBe(false)
    expect(assertMgOnly('loopc')).toBe(false)
    expect(assertMgOnly('vb')).toBe(false)
  })
})

describe('operationId', () => {
  it('creates unique ids', () => {
    const a = createOperationId('t')
    const b = createOperationId('t')
    expect(a).not.toBe(b)
    expect(a.startsWith('t_')).toBe(true)
  })
})
