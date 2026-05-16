import { test, expect } from '@playwright/test'

async function loginAsViewer(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('viewer@demo.com')
  await page.getByLabel(/password/i).fill('demo123')
  await page.getByRole('button', { name: /sign in|login/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

test.describe('RBAC — Viewer Role Enforcement (E2E-05)', () => {
  test('viewer can log in and sees dashboard', async ({ page }) => {
    await loginAsViewer(page)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Settings nav items are hidden from Viewer', async ({ page }) => {
    await loginAsViewer(page)

    const settingsLink = page
      .getByRole('link', { name: /^settings$/i })
      .or(page.getByRole('navigation').getByText(/settings/i))

    const isVisible = await settingsLink.isVisible({ timeout: 3_000 }).catch(() => false)
    if (isVisible) {
      const usersLink = page.getByRole('link', { name: /users/i })
      const rolesLink = page.getByRole('link', { name: /roles/i })
      const usersVisible = await usersLink.isVisible({ timeout: 2_000 }).catch(() => false)
      const rolesVisible = await rolesLink.isVisible({ timeout: 2_000 }).catch(() => false)
      expect(usersVisible || rolesVisible).toBe(false)
    } else {
      expect(isVisible).toBe(false)
    }
  })

  test('GET /api/v1/users returns 403 for Viewer', async ({ page }) => {
    await loginAsViewer(page)

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/v1/users', { credentials: 'include' })
      return { status: res.status }
    })

    expect(response.status).toBe(403)
  })

  test('GET /api/v1/roles returns 403 for Viewer', async ({ page }) => {
    await loginAsViewer(page)

    const response = await page.evaluate(async () => {
      const res = await fetch('/api/v1/roles', { credentials: 'include' })
      return { status: res.status }
    })

    expect(response.status).toBe(403)
  })

  test('Viewer cannot directly navigate to /settings/users', async ({ page }) => {
    await loginAsViewer(page)
    await page.goto('/settings/users')
    await page.waitForLoadState('networkidle')
    const isOnUsers = page.url().includes('/settings/users')
    if (isOnUsers) {
      await expect(
        page.getByText(/unauthorized|forbidden|403|access denied|not allowed/i)
      ).toBeVisible({ timeout: 5_000 })
    } else {
      expect(page.url()).not.toContain('/settings/users')
    }
  })
})
