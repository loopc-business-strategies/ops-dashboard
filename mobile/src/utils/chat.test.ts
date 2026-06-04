import { describe, expect, it } from 'vitest'
import { isMongoIdString, onlyMongoIds } from './chat'

describe('chat mongo id helpers', () => {
  it('accepts 24-char hex ObjectId strings', () => {
    expect(isMongoIdString('507f1f77bcf86cd799439011')).toBe(true)
    expect(isMongoIdString('ABCDEFabcdef0123456789ab')).toBe(true)
  })

  it('rejects invalid ids', () => {
    expect(isMongoIdString('')).toBe(false)
    expect(isMongoIdString('short')).toBe(false)
    expect(isMongoIdString('507f1f77bcf86cd79943901')).toBe(false)
    expect(isMongoIdString('507f1f77bcf86cd799439011g')).toBe(false)
  })

  it('onlyMongoIds filters and dedupes', () => {
    expect(
      onlyMongoIds(['507f1f77bcf86cd799439011', 'bad', undefined, ' 507f1f77bcf86cd799439011 ']),
    ).toEqual(['507f1f77bcf86cd799439011'])
  })
})
