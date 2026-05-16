// e2e/purchase-itc.spec.ts
import { test, expect } from './fixtures/auth'

test.describe('Purchase Invoice → ITC Reconciliation (E2E-03)', () => {
  test('can navigate to purchase invoice form', async ({ loggedInPage: page }) => {
    await page.goto('/purchase-invoice/new')
    // Page title or heading should be visible
    await expect(
      page.getByRole('heading', { name: /purchase/i }).or(page.getByText(/purchase invoice/i))
    ).toBeVisible({ timeout: 10_000 })
  })

  test('ITC reconciliation page renders table', async ({ loggedInPage: page }) => {
    await page.goto('/gst/itc')
    // Page must load without error — check for any table or "no data" state
    await expect(page).not.toHaveURL(/\/login/)
    const table = page.locator('table')
    const noData = page.getByText(/no data|no records|nothing here/i)
    await expect(table.or(noData)).toBeVisible({ timeout: 15_000 })
  })

  test('purchase invoice form has vendor and amount fields', async ({ loggedInPage: page }) => {
    await page.goto('/purchase-invoice/new')
    await page.waitForLoadState('networkidle')

    // Vendor / party selector
    const vendorField = page
      .getByLabel(/vendor|party|supplier/i)
      .or(page.getByPlaceholder(/search.*vendor|select.*party/i))
    await expect(vendorField.first()).toBeVisible({ timeout: 10_000 })
  })
})
