/**
 * Account summary/enquiry caches must use resolveRequestTenantKey(req),
 * not req.user.company (undefined on User documents → shared default: keys).
 */

const { resolveRequestTenantKey } = require('../config/tenants')
const { createReportResponseCache } = require('../utils/reportResponseCache')

function buildSummaryCacheKey(req, page = 1, limit = 50) {
  const cache = createReportResponseCache(1000)
  return cache.buildKey([
    resolveRequestTenantKey(req),
    req.user?._id || req.user?.id || 'user',
    'summary-accounts',
    page,
    limit,
  ])
}

function buildEnquiryCacheKey(req, accountCode = '1000') {
  const cache = createReportResponseCache(1000)
  return cache.buildKey([
    resolveRequestTenantKey(req),
    req.user?._id || req.user?.id || 'user',
    'account-enquiry',
    accountCode,
    'stmt',
    40,
    'nocount',
    '',
    '',
    '',
    '',
    '',
  ])
}

describe('ERP accounts cache tenant keys', () => {
  const sameUser = { _id: 'user-shared-id' }

  test('MG and CG produce different summary keys for the same user id', () => {
    const mg = buildSummaryCacheKey({ tenant: 'mg', user: sameUser })
    const cg = buildSummaryCacheKey({ tenant: 'cg', user: sameUser })
    expect(mg).toMatch(/^mg:/)
    expect(cg).toMatch(/^cg:/)
    expect(mg).not.toBe(cg)
  })

  test('VB and loopc enquiry keys are isolated', () => {
    const vb = buildEnquiryCacheKey({ tenant: 'vb', user: sameUser })
    const loopc = buildEnquiryCacheKey({ tenant: 'loopc', user: sameUser })
    expect(vb).toMatch(/^vb:/)
    expect(loopc).toMatch(/^loopc:/)
    expect(vb).not.toBe(loopc)
  })

  test('legacy req.user.company alone does not scope cache (stays default)', () => {
    const withCompanyOnly = buildSummaryCacheKey({ user: { ...sameUser, company: 'cg' } })
    const withTenant = buildSummaryCacheKey({ tenant: 'cg', user: sameUser })
    expect(withCompanyOnly).toMatch(/^default:/)
    expect(withCompanyOnly).not.toBe(withTenant)
  })

  test('default tenant keys must not be used for shared account caches', () => {
    const key = resolveRequestTenantKey({ user: { company: 'cg' } })
    expect(key).toBe('default')
    const canCache = Boolean(key) && key !== 'default'
    expect(canCache).toBe(false)
  })
})
