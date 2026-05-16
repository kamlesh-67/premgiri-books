/**
 * tests/lib/schemas/masters.test.ts
 *
 * RED phase: Tests for lib/schemas/masters.ts Zod schemas.
 * Verifies GSTIN/PAN/HSN validation with exact plain-English error messages (UX-04).
 */
import { describe, it, expect } from 'vitest'
import {
  ledgerSchema,
  customerSchema,
  supplierSchema,
  stockItemSchema,
  uomSchema,
  godownSchema,
  userPreferencesSchema,
} from '@/lib/schemas/masters'
import { credentialsSchema } from '@/lib/schemas/auth'

// ─── credentialsSchema ────────────────────────────────────────────────────────

describe('credentialsSchema', () => {
  it('accepts valid email and password', () => {
    const result = credentialsSchema.safeParse({ email: 'user@example.com', password: 'secret' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = credentialsSchema.safeParse({ email: 'not-an-email', password: 'secret' })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('Please enter a valid email address')
  })

  it('rejects empty password', () => {
    const result = credentialsSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('This field is required')
  })
})

// ─── GSTIN validation (MAST-02) ───────────────────────────────────────────────

describe('GSTIN validation', () => {
  const validGstin = '29ABCDE1234F1Z5'

  it('accepts a valid GSTIN', () => {
    const result = ledgerSchema.safeParse({
      name: 'Test Ledger',
      groupId: 'cly0000000000000000000000',
      gstin: validGstin,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty string GSTIN (optional)', () => {
    const result = ledgerSchema.safeParse({
      name: 'Test Ledger',
      groupId: 'cly0000000000000000000000',
      gstin: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects malformed GSTIN with plain-English message', () => {
    const result = ledgerSchema.safeParse({
      name: 'Test Ledger',
      groupId: 'cly0000000000000000000000',
      gstin: 'INVALID',
    })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe(
      "This GSTIN doesn't look right — it should be 15 characters like 29ABCDE1234F1Z5"
    )
  })

  it('rejects 14-char GSTIN (too short)', () => {
    const result = ledgerSchema.safeParse({
      name: 'Test Ledger',
      groupId: 'cly0000000000000000000000',
      gstin: '29ABCDE1234F1Z',
    })
    expect(result.success).toBe(false)
  })
})

// ─── PAN validation (MAST-02) ─────────────────────────────────────────────────

describe('PAN validation', () => {
  it('accepts a valid PAN', () => {
    const result = ledgerSchema.safeParse({
      name: 'Test Ledger',
      groupId: 'cly0000000000000000000000',
      pan: 'ABCDE1234F',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty string PAN (optional)', () => {
    const result = ledgerSchema.safeParse({
      name: 'Test Ledger',
      groupId: 'cly0000000000000000000000',
      pan: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects malformed PAN with plain-English message', () => {
    const result = ledgerSchema.safeParse({
      name: 'Test Ledger',
      groupId: 'cly0000000000000000000000',
      pan: 'INVALID',
    })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe(
      "This PAN doesn't look right — it should be 10 characters like ABCDE1234F"
    )
  })
})

// ─── HSN validation ───────────────────────────────────────────────────────────

describe('HSN validation', () => {
  it('accepts a 4-digit HSN code', () => {
    const result = stockItemSchema.safeParse({
      name: 'Widget',
      gstRate: 18,
      hsnCode: '1234',
      uomId: 'cly0000000000000000000000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a 6-digit HSN code', () => {
    const result = stockItemSchema.safeParse({
      name: 'Widget',
      gstRate: 18,
      hsnCode: '123456',
      uomId: 'cly0000000000000000000000',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty HSN (optional)', () => {
    const result = stockItemSchema.safeParse({
      name: 'Widget',
      gstRate: 18,
      hsnCode: '',
      uomId: 'cly0000000000000000000000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects 5-digit HSN with plain-English message', () => {
    const result = stockItemSchema.safeParse({
      name: 'Widget',
      gstRate: 18,
      hsnCode: '12345',
      uomId: 'cly0000000000000000000000',
    })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('HSN code must be 4 or 6 digits')
  })
})

// ─── GST rate validation ──────────────────────────────────────────────────────

describe('GST rate validation', () => {
  it.each([0, 5, 12, 18, 28])('accepts GST rate %s', (rate) => {
    const result = stockItemSchema.safeParse({
      name: 'Widget',
      gstRate: rate,
      uomId: 'cly0000000000000000000000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid GST rate', () => {
    const result = stockItemSchema.safeParse({
      name: 'Widget',
      gstRate: 7,
      uomId: 'cly0000000000000000000000',
    })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('Select a valid GST rate (0, 5, 12, 18, or 28%)')
  })
})

// ─── Credit days validation ───────────────────────────────────────────────────

describe('credit days validation', () => {
  it('rejects negative credit days with plain-English message', () => {
    const result = customerSchema.safeParse({
      name: 'Test Customer',
      creditDays: -1,
    })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('Payment days must be 0 or more')
  })

  it('accepts zero credit days', () => {
    const result = customerSchema.safeParse({
      name: 'Test Customer',
      creditDays: 0,
    })
    expect(result.success).toBe(true)
  })
})

// ─── Required field validation ────────────────────────────────────────────────

describe('required field validation', () => {
  it('rejects short customer name with required message', () => {
    const result = customerSchema.safeParse({ name: 'A' })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('This field is required')
  })

  it('rejects empty UoM name', () => {
    const result = uomSchema.safeParse({ name: '', symbol: 'kg' })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('This field is required')
  })
})

// ─── userPreferencesSchema ────────────────────────────────────────────────────

describe('userPreferencesSchema', () => {
  it('accepts simple mode', () => {
    expect(userPreferencesSchema.safeParse({ uiMode: 'simple' }).success).toBe(true)
  })

  it('accepts advanced mode', () => {
    expect(userPreferencesSchema.safeParse({ uiMode: 'advanced' }).success).toBe(true)
  })

  it('rejects invalid mode', () => {
    expect(userPreferencesSchema.safeParse({ uiMode: 'expert' }).success).toBe(false)
  })
})

// ─── supplierSchema ───────────────────────────────────────────────────────────

describe('supplierSchema', () => {
  it('accepts valid supplier with bank details', () => {
    const result = supplierSchema.safeParse({
      name: 'ACME Supplies',
      bankName: 'HDFC Bank',
      bankAccount: '12345678901234',
      ifsc: 'HDFC0001234',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid IFSC', () => {
    const result = supplierSchema.safeParse({
      name: 'ACME Supplies',
      ifsc: 'INVALID',
    })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('IFSC code should be 11 characters like HDFC0001234')
  })
})

// ─── godownSchema ─────────────────────────────────────────────────────────────

describe('godownSchema', () => {
  it('accepts valid godown', () => {
    expect(godownSchema.safeParse({ name: 'Main Warehouse' }).success).toBe(true)
  })

  it('rejects short godown name', () => {
    const result = godownSchema.safeParse({ name: 'A' })
    expect(result.success).toBe(false)
    const issue = result.error!.issues[0]
    expect(issue.message).toBe('This field is required')
  })
})
