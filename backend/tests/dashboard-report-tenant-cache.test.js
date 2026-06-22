/**
 * Dashboard/report caches must be keyed per tenant (req.tenant from JWT),
 * not req.user.company which is undefined on User documents.
 */

const { resolveRequestTenantKey } = require('../config/tenants')

function buildDashboardCacheKey(req, periodStart, periodEnd) {
  const tenant = resolveRequestTenantKey(req)
  return `${tenant}:${periodStart.toISOString()}:${periodEnd.toISOString()}`
}

describe('dashboard report cache tenant keys', () => {
  const periodStart = new Date('2026-06-01T00:00:00.000Z')
  const periodEnd = new Date('2026-06-30T23:59:59.999Z')

  test('MG and CG produce different cache keys for the same period', () => {
    const mgKey = buildDashboardCacheKey({ tenant: 'mg' }, periodStart, periodEnd)
    const cgKey = buildDashboardCacheKey({ tenant: 'cg' }, periodStart, periodEnd)

    expect(mgKey).toBe('mg:2026-06-01T00:00:00.000Z:2026-06-30T23:59:59.999Z')
    expect(cgKey).toBe('cg:2026-06-01T00:00:00.000Z:2026-06-30T23:59:59.999Z')
    expect(mgKey).not.toBe(cgKey)
  })

  test('loopc is isolated from mg', () => {
    const mgKey = buildDashboardCacheKey({ tenant: 'mg' }, periodStart, periodEnd)
    const loopcKey = buildDashboardCacheKey({ tenant: 'loopc' }, periodStart, periodEnd)

    expect(loopcKey).not.toBe(mgKey)
    expect(loopcKey.startsWith('loopc:')).toBe(true)
  })

  test('legacy req.user.company does not scope cache (was always default)', () => {
    const withUserCompany = buildDashboardCacheKey(
      { user: { company: 'cg' } },
      periodStart,
      periodEnd,
    )
    const withTenant = buildDashboardCacheKey({ tenant: 'cg' }, periodStart, periodEnd)

    expect(withUserCompany).toBe('default:2026-06-01T00:00:00.000Z:2026-06-30T23:59:59.999Z')
    expect(withUserCompany).not.toBe(withTenant)
  })
})
