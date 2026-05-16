import { test, expect } from './fixtures/auth'

test.describe('Dashboard Health (E2E-06)', () => {
  test('dashboard loads without JS errors', async ({ loggedInPage: page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('hydration') &&
        !e.includes('Warning:') &&
        !e.includes('ResizeObserver')
    )

    expect(criticalErrors).toHaveLength(0)
  })

  test('KPI cards are visible on dashboard', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const kpiCards = page.locator('[class*="card"], [class*="kpi"], [class*="stat"]')
    const rupeeAmounts = page.getByText(/₹/)

    const hasCards = await kpiCards.first().isVisible({ timeout: 10_000 }).catch(() => false)
    const hasAmounts = await rupeeAmounts.first().isVisible({ timeout: 5_000 }).catch(() => false)

    expect(hasCards || hasAmounts).toBe(true)
  })

  test('Smart Insights widget renders', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const insightsSection = page
      .getByText('Smart Insights')
      .or(page.getByText(/insights/i))

    await expect(insightsSection.first()).toBeVisible({ timeout: 15_000 })
  })

  test('dashboard does not show login page (auth guard works)', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/dashboard')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('sidebar navigation links are present', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const salesLink = page.getByRole('link', { name: /sales invoice/i })
    const dashboardLink = page.getByRole('link', { name: /dashboard/i })

    await expect(dashboardLink.or(salesLink).first()).toBeVisible({ timeout: 10_000 })
  })
})
