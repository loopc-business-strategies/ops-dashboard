import { test, expect } from '@playwright/test'
import { loginToDashboard, stubAuthApi, stubDashboardDataApi, mockAuthPayload } from './helpers/mockAuth.js'

test.describe('dashboard navigation deep links', () => {
  test('sidebar Ledger link has erp-ledger href', async ({ page }) => {
    await loginToDashboard(page)
    const ledgerLink = page.getByRole('link', { name: 'Ledger' })
    await expect(ledgerLink).toHaveAttribute('href', /tab=erp-ledger/)
  })

  test('navigating to erp-ledger updates URL', async ({ page }) => {
    await loginToDashboard(page)
    await page.goto('/dashboard?tab=erp-ledger')
    await expect(page).toHaveURL(/tab=erp-ledger/)
  })

  test('direct HR deep link preserves sub tab query', async ({ page }) => {
    await stubAuthApi(page)
    await stubDashboardDataApi(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/dashboard?tab=hr&sub=labour_law', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=hr/)
    await expect(page).toHaveURL(/sub=labour_law/)
  })

  test('Account Summary deep link preserves account and view params', async ({ page }) => {
    await stubAuthApi(page)
    await stubDashboardDataApi(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/dashboard?tab=erp-enquiry&account=1000&view=statement', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/tab=erp-enquiry/)
    await expect(page).toHaveURL(/account=1000/)
    await expect(page).toHaveURL(/view=statement/)
  })

  test('restored session loads enquiry tab from URL', async ({ page }) => {
    await stubAuthApi(page)
    await stubDashboardDataApi(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/dashboard?tab=erp-enquiry&account=2100', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('link', { name: 'Account Summary' })).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveURL(/account=2100/)
  })

  test('sidebar Account Summary href targets enquiry tab', async ({ page }) => {
    await loginToDashboard(page)
    const enquiryLink = page.getByRole('link', { name: 'Account Summary' })
    await expect(enquiryLink).toHaveAttribute('href', /tab=erp-enquiry/)
  })

  test('sidebar Account Summary href preserves account from current URL', async ({ page }) => {
    await stubAuthApi(page)
    await stubDashboardDataApi(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/dashboard?tab=erp-enquiry&account=1000&view=statement', { waitUntil: 'domcontentloaded' })
    const enquiryLink = page.getByRole('link', { name: 'Account Summary' })
    await expect(enquiryLink).toHaveAttribute('href', /account=1000/)
    await expect(enquiryLink).toHaveAttribute('href', /view=statement/)
  })
})

test.describe('login auth smoke', () => {
  test('mocked login reaches dashboard shell', async ({ page }) => {
    await stubAuthApi(page)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/login?company=loopc', { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder('Enter your username').fill('e2e-user')
    await page.getByPlaceholder('Enter your password').fill('ValidPass1!')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page.locator('#root')).toBeVisible()
  })

  test('live login when E2E credentials are configured', async ({ page }) => {
    const name = process.env.E2E_AUTH_NAME
    const password = process.env.E2E_AUTH_PASSWORD
    const company = process.env.E2E_AUTH_COMPANY || 'loopc'
    test.skip(!name || !password, 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for live API login')

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/login?company=${company}`, { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder('Enter your username').fill(name)
    await page.getByPlaceholder('Enter your password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })
    await expect(page.locator('#root')).toBeVisible()
  })
})

test.describe('live API enquiry deep link', () => {
  test('opens Account Summary tab with account query after real login', async ({ page }) => {
    const name = process.env.E2E_AUTH_NAME
    const password = process.env.E2E_AUTH_PASSWORD
    const company = process.env.E2E_AUTH_COMPANY || 'loopc'
    const account = process.env.E2E_ENQUIRY_ACCOUNT || '1000'
    test.skip(!name || !password, 'Set E2E_AUTH_NAME and E2E_AUTH_PASSWORD for live enquiry test')

    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(`/login?company=${company}`, { waitUntil: 'domcontentloaded' })
    await page.getByPlaceholder('Enter your username').fill(name)
    await page.getByPlaceholder('Enter your password').fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 })

    await page.goto(`/dashboard?tab=erp-enquiry&account=${encodeURIComponent(account)}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(new RegExp(`account=${account}`))
    await expect(page.getByRole('link', { name: 'Account Summary' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Account Summary', { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  })
})
