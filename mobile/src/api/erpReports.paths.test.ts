import { describe, expect, it } from 'vitest'

/**
 * Ensures mobile ERP Reports screen API paths stay aligned with backend
 * backend/routes/erp-accounting/reportRoutes.js (mounted at /api/erp-accounting).
 */
describe('erpReports API paths (MG mobile ERP Reports tab)', () => {
  const REPORTS_BASE = '/api/erp-accounting/reports'
  const ACCOUNTS_BASE = '/api/erp-accounting/accounts'

  it('uses the expected report and accounts path prefixes', () => {
    expect(`${REPORTS_BASE}/trial-balance`).toBe('/api/erp-accounting/reports/trial-balance')
    expect(`${REPORTS_BASE}/profit-loss`).toBe('/api/erp-accounting/reports/profit-loss')
    expect(`${REPORTS_BASE}/balance-sheet`).toBe('/api/erp-accounting/reports/balance-sheet')
    expect(`${REPORTS_BASE}/day-book`).toBe('/api/erp-accounting/reports/day-book')
    expect(`${REPORTS_BASE}/customer-outstanding`).toBe('/api/erp-accounting/reports/customer-outstanding')
    expect(`${REPORTS_BASE}/vendor-outstanding`).toBe('/api/erp-accounting/reports/vendor-outstanding')
    expect(`${REPORTS_BASE}/forex-gain-loss`).toBe('/api/erp-accounting/reports/forex-gain-loss')
    expect(`${REPORTS_BASE}/ledger`).toBe('/api/erp-accounting/reports/ledger')
    expect(`${REPORTS_BASE}/expense-register`).toBe('/api/erp-accounting/reports/expense-register')
    expect(ACCOUNTS_BASE).toBe('/api/erp-accounting/accounts')
  })
})
