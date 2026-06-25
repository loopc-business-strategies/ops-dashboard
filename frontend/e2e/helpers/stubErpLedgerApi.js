import { stubAuthApi } from './mockAuth.js'

export const e2eMockAccounts = [
  {
    _id: '507f1f77bcf86cd7994390a1',
    accountCode: '1000',
    accountName: 'Cash USD',
    accountType: 'asset',
    isActive: true,
    currencyCode: 'USD',
  },
  {
    _id: '507f1f77bcf86cd7994390a2',
    accountCode: '4000',
    accountName: 'Sales Revenue',
    accountType: 'income',
    isActive: true,
    currencyCode: 'USD',
  },
]

export const e2eMockCurrencies = [
  { _id: 'cur-usd', code: 'USD', name: 'US Dollar', exchangeRate: 1 },
]

const emptyDashboardBody = JSON.stringify({
  success: true,
  projects: [],
  transactions: [],
  customers: [],
  vendors: [],
  products: [],
  movements: [],
  mappings: [],
  settings: {},
  dashboard: {},
  reports: {},
  users: [],
  employees: [],
  messages: [],
  groups: [],
})

/**
 * Stub ERP ledger + JV APIs for browser E2E (accounts, currencies, batch save).
 * Returns `{ batchPosts }` array ref that accumulates journal-voucher POST bodies.
 */
export async function stubErpLedgerJvApi(page) {
  const batchPosts = []

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (/\/api\/auth\//.test(url)) {
      await route.fallback()
      return
    }

    if (/\/erp-accounting\/accounts/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          accounts: e2eMockAccounts,
          total: e2eMockAccounts.length,
        }),
      })
      return
    }

    if (/\/erp-accounting\/currencies/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, currencies: e2eMockCurrencies }),
      })
      return
    }

    if (/\/erp-accounting\/ledger\/next-voucher-no/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, docNo: 'Jv/2026/E2E01' }),
      })
      return
    }

    if (/\/erp-accounting\/ledger\/journal-voucher/.test(url) && method === 'POST') {
      const body = route.request().postDataJSON()
      batchPosts.push(body)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          referenceId: 'e2e-jv-ref-001',
          entries: [],
        }),
      })
      return
    }

    if (/\/erp-accounting\/ledger/.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, entries: [], hasMore: false }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: emptyDashboardBody,
    })
  })

  return { batchPosts }
}

export async function loginToErpLedger(page, company = 'loopc') {
  await stubAuthApi(page)
  const { batchPosts } = await stubErpLedgerJvApi(page)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`/login?company=${company}`, { waitUntil: 'domcontentloaded' })
  await page.getByPlaceholder('Enter your username').fill('e2e-user')
  await page.getByPlaceholder('Enter your password').fill('ValidPass1!')
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  return { batchPosts }
}
