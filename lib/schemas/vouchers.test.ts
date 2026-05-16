import { describe, it, expect } from 'vitest'
import {
  salesInvoiceSchema,
  purchaseInvoiceSchema,
  receiptSchema,
  paymentSchema,
  journalSchema,
  contraSchema,
  creditNoteSchema,
  debitNoteSchema,
  createVoucherSchema,
} from './vouchers'

// ─── salesInvoiceSchema ───────────────────────────────────────────────────────
describe('salesInvoiceSchema', () => {
  const validSales = {
    voucherType: 'SALES' as const,
    partyLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    date: '2024-10-01',
    items: [
      {
        itemId: 'cjld2cjxh0000qzrmn831i7rn',
        qty: '2',
        rate: '100',
      },
    ],
  }

  it('accepts a valid SALES voucher input', () => {
    const result = salesInvoiceSchema.safeParse(validSales)
    expect(result.success).toBe(true)
  })

  it('rejects missing partyLedgerId with plain-English message', () => {
    const result = salesInvoiceSchema.safeParse({ ...validSales, partyLedgerId: undefined })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('customer'))).toBe(true)
    }
  })

  it('rejects empty items array with plain-English message', () => {
    const result = salesInvoiceSchema.safeParse({ ...validSales, items: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('item'))).toBe(true)
    }
  })

  it('rejects line item with qty "0"', () => {
    const result = salesInvoiceSchema.safeParse({
      ...validSales,
      items: [{ itemId: 'cjld2cjxh0000qzrmn831i7rn', qty: '0', rate: '100' }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('quantity'))).toBe(true)
    }
  })

  it('does NOT include companyId in parsed output', () => {
    const result = salesInvoiceSchema.safeParse(validSales)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })

  it('defaults status to POSTED', () => {
    const result = salesInvoiceSchema.safeParse(validSales)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('POSTED')
    }
  })
})

// ─── purchaseInvoiceSchema ────────────────────────────────────────────────────
describe('purchaseInvoiceSchema', () => {
  const validPurchase = {
    voucherType: 'PURCHASE' as const,
    partyLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    date: '2024-10-01',
    items: [
      {
        itemId: 'cjld2cjxh0000qzrmn831i7rn',
        qty: '5',
        rate: '200',
      },
    ],
  }

  it('accepts a valid PURCHASE voucher input', () => {
    const result = purchaseInvoiceSchema.safeParse(validPurchase)
    expect(result.success).toBe(true)
  })

  it('line item has itcEligible defaulting to true (VOUCH-02)', () => {
    const result = purchaseInvoiceSchema.safeParse(validPurchase)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.items[0].itcEligible).toBe(true)
    }
  })

  it('rejects missing partyLedgerId with plain-English message', () => {
    const result = purchaseInvoiceSchema.safeParse({ ...validPurchase, partyLedgerId: undefined })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('supplier'))).toBe(true)
    }
  })

  it('does NOT include companyId in parsed output', () => {
    const result = purchaseInvoiceSchema.safeParse(validPurchase)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})

// ─── receiptSchema ────────────────────────────────────────────────────────────
describe('receiptSchema', () => {
  const validReceipt = {
    voucherType: 'RECEIPT' as const,
    partyLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    bankLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    date: '2024-10-01',
    amount: '5000',
  }

  it('accepts a valid RECEIPT voucher input', () => {
    const result = receiptSchema.safeParse(validReceipt)
    expect(result.success).toBe(true)
  })

  it('accepts settlements array (bill-wise settlement)', () => {
    const result = receiptSchema.safeParse({
      ...validReceipt,
      settlements: [
        { billRefId: 'cjld2cjxh0000qzrmn831i7rn', amount: '5000' },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.settlements).toHaveLength(1)
    }
  })

  it('defaults settlements to empty array', () => {
    const result = receiptSchema.safeParse(validReceipt)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.settlements).toEqual([])
    }
  })

  it('rejects amount "0" with plain-English message', () => {
    const result = receiptSchema.safeParse({ ...validReceipt, amount: '0' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('amount'))).toBe(true)
    }
  })

  it('does NOT include companyId in parsed output', () => {
    const result = receiptSchema.safeParse(validReceipt)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})

// ─── paymentSchema ────────────────────────────────────────────────────────────
describe('paymentSchema', () => {
  const validPayment = {
    voucherType: 'PAYMENT' as const,
    partyLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    bankLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    date: '2024-10-01',
    amount: '10000',
  }

  it('accepts a valid PAYMENT voucher input', () => {
    const result = paymentSchema.safeParse(validPayment)
    expect(result.success).toBe(true)
  })

  it('rejects missing partyLedgerId with plain-English message', () => {
    const result = paymentSchema.safeParse({ ...validPayment, partyLedgerId: undefined })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('supplier'))).toBe(true)
    }
  })

  it('rejects negative amount', () => {
    const result = paymentSchema.safeParse({ ...validPayment, amount: '-100' })
    expect(result.success).toBe(false)
  })

  it('does NOT include companyId in parsed output', () => {
    const result = paymentSchema.safeParse(validPayment)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})

// ─── journalSchema ────────────────────────────────────────────────────────────
describe('journalSchema', () => {
  const validJournal = {
    voucherType: 'JOURNAL' as const,
    date: '2024-10-01',
    entries: [
      { ledgerId: 'cjld2cjxh0000qzrmn831i7rn', amount: '1000', drCr: 'DR' as const },
      { ledgerId: 'cjld2cjxh0001qzrmn831i7rn', amount: '1000', drCr: 'CR' as const },
    ],
  }

  it('accepts a valid JOURNAL voucher input with 2 entries', () => {
    const result = journalSchema.safeParse(validJournal)
    expect(result.success).toBe(true)
  })

  it('rejects entries array with 1 entry with plain-English message', () => {
    const result = journalSchema.safeParse({
      ...validJournal,
      entries: [
        { ledgerId: 'cjld2cjxh0000qzrmn831i7rn', amount: '1000', drCr: 'DR' as const },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('two lines') || m.toLowerCase().includes('at least'))).toBe(true)
    }
  })

  it('does NOT include companyId in parsed output', () => {
    const result = journalSchema.safeParse(validJournal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})

// ─── contraSchema ─────────────────────────────────────────────────────────────
describe('contraSchema', () => {
  const validContra = {
    voucherType: 'CONTRA' as const,
    date: '2024-10-01',
    fromLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    toLedgerId: 'cjld2cjxh0001qzrmn831i7rn',
    amount: '25000',
  }

  it('accepts a valid CONTRA voucher input', () => {
    const result = contraSchema.safeParse(validContra)
    expect(result.success).toBe(true)
  })

  it('rejects missing fromLedgerId', () => {
    const result = contraSchema.safeParse({ ...validContra, fromLedgerId: undefined })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('source'))).toBe(true)
    }
  })

  it('does NOT include companyId in parsed output', () => {
    const result = contraSchema.safeParse(validContra)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})

// ─── creditNoteSchema ─────────────────────────────────────────────────────────
describe('creditNoteSchema', () => {
  const validCreditNote = {
    voucherType: 'CREDIT_NOTE' as const,
    partyLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    date: '2024-10-01',
    items: [
      {
        itemId: 'cjld2cjxh0000qzrmn831i7rn',
        qty: '1',
        rate: '500',
      },
    ],
  }

  it('accepts a valid CREDIT_NOTE voucher input', () => {
    const result = creditNoteSchema.safeParse(validCreditNote)
    expect(result.success).toBe(true)
  })

  it('accepts optional linkedVoucherId', () => {
    const result = creditNoteSchema.safeParse({
      ...validCreditNote,
      linkedVoucherId: 'cjld2cjxh0000qzrmn831i7rn',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty items array', () => {
    const result = creditNoteSchema.safeParse({ ...validCreditNote, items: [] })
    expect(result.success).toBe(false)
  })

  it('does NOT include companyId in parsed output', () => {
    const result = creditNoteSchema.safeParse(validCreditNote)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})

// ─── debitNoteSchema ──────────────────────────────────────────────────────────
describe('debitNoteSchema', () => {
  const validDebitNote = {
    voucherType: 'DEBIT_NOTE' as const,
    partyLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
    date: '2024-10-01',
    items: [
      {
        itemId: 'cjld2cjxh0000qzrmn831i7rn',
        qty: '2',
        rate: '300',
      },
    ],
  }

  it('accepts a valid DEBIT_NOTE voucher input', () => {
    const result = debitNoteSchema.safeParse(validDebitNote)
    expect(result.success).toBe(true)
  })

  it('rejects missing partyLedgerId with plain-English message', () => {
    const result = debitNoteSchema.safeParse({ ...validDebitNote, partyLedgerId: undefined })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.errors.map(e => e.message)
      expect(messages.some(m => m.toLowerCase().includes('supplier'))).toBe(true)
    }
  })

  it('does NOT include companyId in parsed output', () => {
    const result = debitNoteSchema.safeParse(validDebitNote)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})

// ─── createVoucherSchema (discriminated union) ─────────────────────────────────
describe('createVoucherSchema', () => {
  it('discriminates correctly for SALES voucherType', () => {
    const result = createVoucherSchema.safeParse({
      voucherType: 'SALES',
      partyLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
      date: '2024-10-01',
      items: [{ itemId: 'cjld2cjxh0000qzrmn831i7rn', qty: '1', rate: '100' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.voucherType).toBe('SALES')
    }
  })

  it('discriminates correctly for JOURNAL voucherType', () => {
    const result = createVoucherSchema.safeParse({
      voucherType: 'JOURNAL',
      date: '2024-10-01',
      entries: [
        { ledgerId: 'cjld2cjxh0000qzrmn831i7rn', amount: '1000', drCr: 'DR' },
        { ledgerId: 'cjld2cjxh0001qzrmn831i7rn', amount: '1000', drCr: 'CR' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown voucherType', () => {
    const result = createVoucherSchema.safeParse({
      voucherType: 'INVALID_TYPE',
      date: '2024-10-01',
    })
    expect(result.success).toBe(false)
  })

  it('does NOT include companyId in parsed output for any type', () => {
    const result = createVoucherSchema.safeParse({
      voucherType: 'CONTRA',
      date: '2024-10-01',
      fromLedgerId: 'cjld2cjxh0000qzrmn831i7rn',
      toLedgerId: 'cjld2cjxh0001qzrmn831i7rn',
      amount: '50000',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('companyId')
    }
  })
})
