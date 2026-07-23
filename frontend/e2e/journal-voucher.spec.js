import { test, expect } from '@playwright/test'
import { loginToErpLedger } from './helpers/stubErpLedgerApi.js'

test.describe('journal voucher save', () => {
  test.describe.configure({ timeout: 90_000 })

  test('balanced JV posts to journal-voucher batch endpoint', async ({ page }) => {
    const { batchPosts } = await loginToErpLedger(page)

    await expect(page.getByRole('heading', { name: 'Journal Voucher' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: '+ New Journal Voucher' })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: '+ New Journal Voucher' }).click()
    await expect(page.getByRole('button', { name: /Save JV/i })).toBeVisible({ timeout: 10_000 })

    const accountInputs = page.getByPlaceholder('Type account code or name...')
    await accountInputs.nth(0).click()
    await accountInputs.nth(0).fill('1000')
    await page.getByText('1000', { exact: false }).first().click()

    await accountInputs.nth(1).click()
    await accountInputs.nth(1).fill('4000')
    await page.getByText('4000', { exact: false }).first().click()

    const spinbuttons = page.getByRole('spinbutton')
    await spinbuttons.nth(0).fill('100')
    await spinbuttons.nth(3).fill('100')

    await expect(page.getByText(/Balanced/i)).toBeVisible({ timeout: 5_000 })

    const saveButton = page.getByRole('button', { name: /Save JV/i })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    await expect.poll(() => batchPosts.length, { timeout: 15_000 }).toBeGreaterThan(0)

    const payload = batchPosts[0]
    expect(payload.mode).toBe('journal')
    expect(Array.isArray(payload.postings)).toBe(true)
    expect(payload.postings.length).toBeGreaterThanOrEqual(1)

    const debitTotal = payload.postings.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    expect(debitTotal).toBe(100)
  })

  test('unbalanced JV does not POST journal batch', async ({ page }) => {
    const { batchPosts } = await loginToErpLedger(page)

    await expect(page.getByRole('heading', { name: 'Journal Voucher' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: '+ New Journal Voucher' }).click()
    await expect(page.getByRole('button', { name: /Save JV/i })).toBeVisible({ timeout: 10_000 })

    const accountInputs = page.getByPlaceholder('Type account code or name...')
    await accountInputs.nth(0).click()
    await accountInputs.nth(0).fill('1000')
    await page.getByText('1000', { exact: false }).first().click()

    await accountInputs.nth(1).click()
    await accountInputs.nth(1).fill('4000')
    await page.getByText('4000', { exact: false }).first().click()

    const spinbuttons = page.getByRole('spinbutton')
    await spinbuttons.nth(0).fill('100')
    await spinbuttons.nth(3).fill('50')

    await expect(page.getByText(/not balanced/i)).toBeVisible({ timeout: 5_000 })

    const saveButton = page.getByRole('button', { name: /Save JV/i })
    await expect(saveButton).toBeDisabled()
    expect(batchPosts).toHaveLength(0)
  })
})
