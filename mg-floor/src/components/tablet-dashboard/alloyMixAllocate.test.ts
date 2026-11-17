import { describe, expect, it } from 'vitest'
import {
  buildAllocateWeightPayload,
  formatAllocateSuccess,
  formatInputComponents,
  resolveAllocateWeight,
} from './alloyMixAllocate'

describe('formatInputComponents', () => {
  it('joins product names and grams', () => {
    expect(formatInputComponents([
      { name: 'pure copper', gross: 19.23 },
      { name: 'silver pure', gross: 47.12 },
      { name: 'Gold Bar', gross: 199.05 },
    ])).toBe('pure copper: 19.23 g · silver pure: 47.12 g · Gold Bar: 199.05 g')
  })

  it('returns empty for missing or zero rows', () => {
    expect(formatInputComponents(null)).toBe('')
    expect(formatInputComponents([{ name: 'x', gross: 0 }])).toBe('')
  })
})

describe('resolveAllocateWeight', () => {
  it('uses typed weight when valid and within available', () => {
    expect(resolveAllocateWeight(80, '30')).toEqual({ available: 80, weight: 30 })
  })

  it('falls back to available when typed is empty or invalid', () => {
    expect(resolveAllocateWeight(80, '')).toEqual({ available: 80, weight: 80 })
    expect(resolveAllocateWeight(80, 'abc')).toEqual({ available: 80, weight: 80 })
  })

  it('rejects over-available weight', () => {
    expect(resolveAllocateWeight(50, '51').error).toMatch(/Only 50 g available/)
  })
})

describe('buildAllocateWeightPayload', () => {
  it('omits weight for full allocate; includes weight for partial split', () => {
    expect(buildAllocateWeightPayload(80, 80)).toEqual({})
    expect(buildAllocateWeightPayload(80, 30)).toEqual({ weight: 30 })
  })
})

describe('formatAllocateSuccess', () => {
  it('formats full allocate vs partial split copy', () => {
    expect(formatAllocateSuccess({
      fromCode: 'AMX-1',
      destLabel: 'Melting',
      weight: 80,
    })).toBe('Allocated AMX-1 (80 g) → Melting')

    expect(formatAllocateSuccess({
      partial: true,
      fromCode: 'AMX-1',
      destLabel: 'Melting',
      weight: 30,
      childMixCode: 'AMX-1A',
      parentRemaining: 50,
    })).toBe('Split 30 g → Melting as AMX-1A · AMX-1 keeps 50 g')
  })

  it('notes when destination must Approve receive', () => {
    expect(formatAllocateSuccess({
      pendingReceive: true,
      fromCode: 'AMX-1',
      destLabel: 'Melting',
      weight: 80,
    })).toBe('Allocated AMX-1 (80 g) → Melting — waiting for receive Approve')

    expect(formatAllocateSuccess({
      partial: true,
      pendingReceive: true,
      fromCode: 'AMX-1',
      destLabel: 'Melting',
      weight: 30,
      childMixCode: 'AMX-1A',
      parentRemaining: 50,
    })).toBe('Split 30 g → Melting as AMX-1A · AMX-1 keeps 50 g — waiting for receive Approve')
  })
})
