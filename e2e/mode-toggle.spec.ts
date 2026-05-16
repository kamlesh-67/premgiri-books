import { test, expect } from './fixtures/auth'

test.describe('Simple / Advanced Mode Toggle (E2E-08)', () => {
  test('mode toggle button is visible on dashboard', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const toggle = page.locator('button[aria-pressed]')
    await expect(toggle.first()).toBeVisible({ timeout: 10_000 })
  })

  test('clicking toggle changes aria-pressed state', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const toggle = page.locator('button[aria-pressed]').first()
    await toggle.waitFor({ state: 'visible', timeout: 10_000 })

    const beforeState = await toggle.getAttribute('aria-pressed')

    await toggle.click()

    await page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/user/preferences') && resp.status() === 200,
      { timeout: 10_000 }
    ).catch(() => {})

    const afterState = await toggle.getAttribute('aria-pressed')
    expect(afterState).not.toBe(beforeState)
  })

  test('mode persists after page reload (cookie-based persistence)', async ({
    loggedInPage: page,
  }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const toggle = page.locator('button[aria-pressed]').first()
    await toggle.waitFor({ state: 'visible', timeout: 10_000 })

    const beforeState = await toggle.getAttribute('aria-pressed')

    await toggle.click()

    await page.waitForTimeout(1_500)

    await page.reload()
    await page.waitForLoadState('networkidle')

    const toggleAfterReload = page.locator('button[aria-pressed]').first()
    await toggleAfterReload.waitFor({ state: 'visible', timeout: 10_000 })

    const afterReloadState = await toggleAfterReload.getAttribute('aria-pressed')

    expect(afterReloadState).not.toBe(beforeState)
  })

  test('ui-mode cookie is set after toggle', async ({ loggedInPage: page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    const toggle = page.locator('button[aria-pressed]').first()
    await toggle.waitFor({ state: 'visible', timeout: 10_000 })
    await toggle.click()

    await page.waitForTimeout(1_000)

    const cookies = await page.context().cookies()
    const uiModeCookie = cookies.find((c) => c.name === 'ui-mode')

    expect(uiModeCookie).toBeDefined()
    expect(['simple', 'advanced']).toContain(uiModeCookie?.value)
  })
})
