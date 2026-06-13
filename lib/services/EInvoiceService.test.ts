/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// These tests run BEFORE EInvoiceService is implemented — they should FAIL (RED)
// Plans 08-02 turns them GREEN

describe('EInvoiceService', () => {
  describe('isEligible', () => {
    it('returns false for DRAFT vouchers', async () => {
      const { isEligible } = await import('./EInvoiceService')
      const result = await isEligible(
        { id: 'v1', status: 'DRAFT', voucherType: 'SALES', totalAmount: '100000', irn: null } as any,
        { annualTurnover: '600000000' } as any,
      )
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('POSTED')
    })

    it('returns false when party has no GSTIN', async () => {
      const { isEligible } = await import('./EInvoiceService')
      const result = await isEligible(
        { id: 'v1', status: 'POSTED', voucherType: 'SALES', totalAmount: '100000', irn: null, partyLedger: { gstin: null } } as any,
        { annualTurnover: '600000000' } as any,
      )
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('GSTIN')
    })

    it('returns false when IRN already generated', async () => {
      const { isEligible } = await import('./EInvoiceService')
      const result = await isEligible(
        { id: 'v1', status: 'POSTED', voucherType: 'SALES', totalAmount: '100000', irn: 'existing-irn', partyLedger: { gstin: '27ABC' } } as any,
        { annualTurnover: '600000000' } as any,
      )
      expect(result.eligible).toBe(false)
      expect(result.reason).toContain('already')
    })

    it('returns true for eligible POSTED SALES with party GSTIN and no existing IRN', async () => {
      const { isEligible } = await import('./EInvoiceService')
      const result = await isEligible(
        {
          id: 'v1', status: 'POSTED', voucherType: 'SALES', totalAmount: '100000', irn: null,
          date: new Date(),
          partyLedger: { gstin: '27AABCT1332L1ZV' },
        } as any,
        { annualTurnover: '600000000' } as any,
      )
      expect(result.eligible).toBe(true)
    })
  })

  describe('buildPayload', () => {
    beforeEach(() => {
      vi.stubEnv('IRP_MOCK_MODE', 'true')
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('maps VoucherItem fields to IRP ItemList correctly', async () => {
      const { buildPayload } = await import('./EInvoiceService')
      const voucher = {
        id: 'v1', voucherNo: 'SI-2024-25-0001', date: new Date('2025-04-07'),
        totalAmount: '5900', cgstAmount: '450', sgstAmount: '450', igstAmount: '0', roundOff: '0',
        partyLedger: { gstin: '27XYZAB1234C1Z5', name: 'Test Corp' },
        items: [{
          id: 'i1', qty: '5', rate: '1000', amount: '5000', discountAmt: '0',
          cgstRate: '9', cgstAmt: '450', sgstRate: '9', sgstAmt: '450', igstRate: '0', igstAmt: '0',
          hsnCode: '62011090',
          stockItem: { name: 'Test Item', uom: { symbol: 'PCS' } }
        }],
      } as any
      const company = { gstin: '29ABCDE1234F1Z5', stateCode: '29', name: 'My Co' } as any

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = buildPayload(voucher, company) as any

      expect(payload.DocDtls.No).toBe('SI-2024-25-0001')
      expect(payload.DocDtls.Typ).toBe('INV')
      expect(payload.SellerDtls.Gstin).toBe('29ABCDE1234F1Z5')
      expect(payload.BuyerDtls.Gstin).toBe('27XYZAB1234C1Z5')
      expect(payload.ItemList).toHaveLength(1)
      expect(payload.ItemList[0].HsnCd).toBe('62011090')
      expect(typeof payload.ItemList[0].Qty).toBe('number')
      expect(typeof payload.ValDtls.TotInvVal).toBe('number')
    })

    it('CGST and SGST amounts are equal for intra-state invoice', async () => {
      const { buildPayload } = await import('./EInvoiceService')
      const voucher = {
        id: 'v1', voucherNo: 'SI-2024-25-0001', date: new Date(),
        totalAmount: '5900', cgstAmount: '450', sgstAmount: '450', igstAmount: '0', roundOff: '0',
        partyLedger: { gstin: '29XYZAB1234C1Z5', name: 'Same State Corp' },
        items: [{
          id: 'i1', qty: '5', rate: '1000', amount: '5000', discountAmt: '0',
          cgstRate: '9', cgstAmt: '450', sgstRate: '9', sgstAmt: '450', igstRate: '0', igstAmt: '0',
          hsnCode: '62011090',
          stockItem: { name: 'Test Item', uom: { symbol: 'PCS' } }
        }],
      } as any
      const company = { gstin: '29ABCDE1234F1Z5', stateCode: '29', name: 'My Co' } as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = buildPayload(voucher, company) as any
      expect(payload.ValDtls.CgstVal).toBe(payload.ValDtls.SgstVal)
    })
  })
})
