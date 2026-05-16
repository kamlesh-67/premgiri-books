import { test as base, Page } from '@playwright/test'

export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    const email = process.env.PLAYWRIGHT_TEST_EMAIL ?? 'accountant@demo.com'
    const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? 'demo123'

    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in|login/i }).click()
    await page.waitForURL('**/dashboard', { timeout: 15_000 })

    await use(page)
  },
})

export { expect } from '@playwright/test'
