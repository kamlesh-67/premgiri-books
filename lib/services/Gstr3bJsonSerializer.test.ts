import { describe, it, expect } from 'vitest'

describe('Gstr3bJsonSerializer', () => {
  describe('serialize', () => {
    it('produces GSTN-format JSON with correct ret_period', async () => {
      const { serialize } = await import('./Gstr3bJsonSerializer')
      const summary = {
        outwardTaxable: { taxableValue: '100000', cgst: '9000', sgst: '9000', igst: '0' },
        outwardZeroRated: { taxableValue: '0', igst: '0' },
        outwardNilExempt: { taxableValue: '0' },
        inwardRcm: { taxableValue: '0', cgst: '0', sgst: '0', igst: '0' },
        itcAvailable: { cgst: '9000', sgst: '9000', igst: '0' },
      }
      const result = serialize(summary, '29ABCDE1234F1Z5', '04/2025')

      expect(result.gstin).toBe('29ABCDE1234F1Z5')
      expect(result.ret_period).toBe('042025')   // MMYYYY not MM/YYYY
      expect(result.sup_details.osup_det.txval).toBe('100000.00')
      expect(result.sup_details.osup_det.camt).toBe('9000.00')
      expect(result.sup_details.osup_det.samt).toBe('9000.00')
      expect(result.sup_details.osup_det.iamt).toBe('0.00')
    })

    it('all amount fields are strings with 2 decimal places', async () => {
      const { serialize } = await import('./Gstr3bJsonSerializer')
      const summary = {
        outwardTaxable: { taxableValue: '50000', cgst: '4500', sgst: '4500', igst: '0' },
        outwardZeroRated: { taxableValue: '0', igst: '0' },
        outwardNilExempt: { taxableValue: '0' },
        inwardRcm: { taxableValue: '0', cgst: '0', sgst: '0', igst: '0' },
        itcAvailable: { cgst: '4500', sgst: '4500', igst: '0' },
      }
      const result = serialize(summary, '29ABCDE1234F1Z5', '04/2025')
      // Verify all values are string type, not number
      expect(typeof result.sup_details.osup_det.txval).toBe('string')
      expect(typeof result.sup_details.osup_det.camt).toBe('string')
      expect(result.sup_details.osup_det.txval).toMatch(/^\d+\.\d{2}$/)
    })
  })
})
