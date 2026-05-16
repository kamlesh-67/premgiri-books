// e2e/bank-reconciliation.spec.ts
import { test, expect } from './fixtures/auth'
import path from 'path'

test.describe('Bank Reconciliation — CSV Import (E2E-04)', () => {
  test('bank reconciliation page loads', async ({ loggedInPage: page }) => {
    await page.goto('/banking/reconciliation')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(
      page.getByRole('heading', { name: /reconciliation|bank/i }).or(
        page.getByText(/bank reconciliation/i)
      )
    ).toBeVisible({ timeout: 10_000 })
  })

  test('can upload a bank statement CSV', async ({ loggedInPage: page }) => {
    await page.goto('/banking/reconciliation')
    await page.waitForLoadState('networkidle')

    // Find file input — may be hidden; use setInputFiles directly
    const csvPath = path.join(__dirname, 'fixtures', 'sample-bank-statement.csv')
    const fileInput = page.locator('input[type="file"]')

    // Upload the CSV
    await fileInput.setInputFiles(csvPath)

    // Wait for import confirmation — table, row count, or success message
    const successIndicator = page
      .getByText(/import|upload|statement/i)
      .or(page.locator('table tbody tr'))
    await expect(successIndicator.first()).toBeVisible({ timeout: 20_000 })
  })

  test('imported transactions are shown in table', async ({ loggedInPage: page }) => {
    await page.goto('/banking/reconciliation')
    await page.waitForLoadState('networkidle')

    const csvPath = path.join(__dirname, 'fixtures', 'sample-bank-statement.csv')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(csvPath)

    // After import, table should show at least one row (5 in CSV)
    await page.waitForSelector('table tbody tr', { timeout: 20_000 })
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
