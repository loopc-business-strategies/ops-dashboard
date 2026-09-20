import { describe, expect, it } from 'vitest'
import { classifyCacheFreshness, shouldSkipNetworkFetch } from './cachePolicy'

describe('cachePolicy', () => {
  const ttl = 5 * 60 * 1000
  const now = 1_000_000

  it('classifies fresh within TTL', () => {
    expect(classifyCacheFreshness(now - 1000, ttl, now)).toBe('fresh')
  })

  it('classifies stale after TTL', () => {
    expect(classifyCacheFreshness(now - ttl - 1, ttl, now)).toBe('stale')
  })

  it('skips network when offline with cache', () => {
    expect(shouldSkipNetworkFetch({ offline: true, hasCachedOrLiveData: true })).toBe(true)
  })

  it('does not skip network when online', () => {
    expect(shouldSkipNetworkFetch({ offline: false, hasCachedOrLiveData: true })).toBe(false)
  })

  it('does not skip when offline without cache', () => {
    expect(shouldSkipNetworkFetch({ offline: true, hasCachedOrLiveData: false })).toBe(false)
  })
})
