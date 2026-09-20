/** Pure helpers for useAsyncResource cache freshness decisions. */

export type CacheFreshness = 'fresh' | 'stale' | 'expired'

export function cacheAgeMs(cachedAt: number, now = Date.now()): number {
  return Math.max(0, now - cachedAt)
}

/**
 * fresh: within TTL
 * stale: older than TTL but still usable offline / as LAST KNOWN
 * expired: treated same as stale for display; online should refresh
 */
export function classifyCacheFreshness(
  cachedAt: number,
  cacheTtlMs: number,
  now = Date.now(),
): CacheFreshness {
  const age = cacheAgeMs(cachedAt, now)
  if (age <= cacheTtlMs) return 'fresh'
  // Soft expiry: still displayable as LAST KNOWN / STALE
  if (age <= cacheTtlMs * 24) return 'stale'
  return 'expired'
}

export function shouldSkipNetworkFetch(opts: {
  offline: boolean
  hasCachedOrLiveData: boolean
}): boolean {
  // CASE A: offline + cache → never hit network
  return opts.offline && opts.hasCachedOrLiveData
}
