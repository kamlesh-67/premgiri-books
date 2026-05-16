import { test as setup } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL ?? 'accountant@demo.com'
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD ?? 'demo123'

  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in|login/i }).click()
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  await page.context().storageState({ path: authFile })
})
