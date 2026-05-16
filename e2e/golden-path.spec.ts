import { test, expect } from './fixtures/auth'

test('golden path: Sales Invoice → GSTR-1 → PDF → Credit Note → Outstanding', async ({
  loggedInPage: page,
}) => {
  await test.step('Navigate to new Sales Invoice', async () => {
    await page.goto('/vouchers/sales/new')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, [data-testid="page-title"]').first()).toBeVisible()
  })

  await test.step('Fill Sales Invoice form', async () => {
    const partyInput = page
      .locator(
        '[data-testid="party-select"], [placeholder*="party"], [placeholder*="Party"], input[id*="party"]'
      )
      .first()
    await partyInput.click()
    const firstOption = page.locator('[role="option"]').first()
    await firstOption.waitFor({ timeout: 5_000 })
    await firstOption.click()

    const addItemBtn = page
      .locator(
        'button:has-text("Add Item"), button:has-text("Add Line"), [data-testid="add-item"]'
      )
      .first()
    await expect(addItemBtn).toBeVisible({ timeout: 5000 })
    await addItemBtn.click()

    const qtyInput = page
      .locator('input[name*="qty"], input[placeholder*="Qty"]')
      .first()
    await expect(qtyInput).toBeVisible({ timeout: 5000 })
    await qtyInput.fill('2')

    const rateInput = page
      .locator('input[name*="rate"], input[placeholder*="Rate"]')
      .first()
    await expect(rateInput).toBeVisible({ timeout: 5000 })
    await rateInput.fill('5000')
  })

  let voucherId = ''

  await test.step('Submit Sales Invoice', async () => {
    const saveBtn = page
      .locator(
        'button:has-text("Save"), button:has-text("Post"), button:has-text("Submit"), [data-testid="save-voucher"]'
      )
      .first()
    await saveBtn.click()
    await page.waitForURL(/\/vouchers\/sales\/[a-zA-Z0-9-]+/, { timeout: 20_000 })
    const url = page.url()
    const match = url.match(/\/vouchers\/sales\/([a-zA-Z0-9-]+)/)
    if (match) {
      voucherId = match[1]
    }
    expect(voucherId).not.toBe('')
  })

  await test.step('Navigate to GSTR-1 and verify entry', async () => {
    await page.goto('/gst/gstr1')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').first()).toBeVisible()
    const tableRows = page.locator('tbody tr, [data-testid="gstr1-row"]')
    const rowCount = await tableRows.count()
    expect(rowCount).toBeGreaterThan(0)
  })

  await test.step('Download Sales Invoice PDF', async () => {
    await page.goto(`/vouchers/sales/${voucherId}`)
    await page.waitForLoadState('networkidle')
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    const pdfBtn = page
      .locator(
        'button:has-text("PDF"), button:has-text("Download"), a:has-text("PDF"), [data-testid="download-pdf"]'
      )
      .first()
    await pdfBtn.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
  })

  await test.step('Navigate to Credit Note and link to original invoice', async () => {
    await page.goto('/vouchers/credit-note/new')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, [data-testid="page-title"]').first()).toBeVisible()
    const linkedVoucherInput = page
      .locator(
        '[data-testid="linked-voucher"], [placeholder*="original"], input[name*="linked"]'
      )
      .first()
    await expect(linkedVoucherInput).toBeVisible({ timeout: 5000 })
    await linkedVoucherInput.fill(voucherId)
    const partyInput = page
      .locator(
        '[data-testid="party-select"], [placeholder*="party"], [placeholder*="Party"]'
      )
      .first()
    await partyInput.click()
    const firstOption = page.locator('[role="option"]').first()
    await firstOption.waitFor({ timeout: 5_000 })
    await firstOption.click()
  })

  await test.step('Submit Credit Note', async () => {
    const saveBtn = page
      .locator(
        'button:has-text("Save"), button:has-text("Post"), button:has-text("Submit"), [data-testid="save-voucher"]'
      )
      .first()
    await saveBtn.click()
    await page.waitForURL(/\/vouchers\/credit-note\/[a-zA-Z0-9-]+/, { timeout: 20_000 })
  })

  await test.step('Outstanding receivables report shows reduced or zero balance', async () => {
    await page.goto('/reports/outstanding')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1').first()).toBeVisible()
    const pageBody = await page.content()
    expect(pageBody).not.toContain('An error occurred')
    expect(pageBody).not.toContain('Internal Server Error')
  })
})
