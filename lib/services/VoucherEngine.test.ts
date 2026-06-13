/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * VoucherEngine.test.ts
 *
 * Tests for the VoucherEngine service using a mocked Prisma transaction client.
 * No real DB connection needed — all Prisma calls are vi.fn() stubs.
 *
 * RED phase: These tests import a module that does not yet exist.
 * Running pnpm test will fail with "Cannot find module" errors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  ValidationError,
  validateBalance,
  getNextVoucherNo,
  createVoucher,
  cancelVoucher,
  postVoucher,
} from './VoucherEngine'

// ─── Shared mock factory ─────────────────────────────────────────────────────

/**
 * Creates a minimal mock Prisma transaction client (tx) with all methods
 * needed by VoucherEngine. Individual tests can override specific mocks.
 */
function makeMockTx(overrides: Record<string, unknown> = {}) {
  const voucherCreateResult = {
    id: 'v-001',
    companyId: 'c-001',
    voucherType: 'SALES',
    voucherNo: 'SI-2024-25-0001',
    date: new Date('2024-10-01'),
    totalAmount: new Decimal('11800'),
    status: 'POSTED',
    narration: null,
    partyLedgerId: 'l-party',
    cgstAmount: new Decimal('900'),
    sgstAmount: new Decimal('900'),
    igstAmount: new Decimal('0'),
    roundOff: new Decimal('0'),
    createdBy: 'u-001',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return {
    $executeRaw: vi.fn().mockResolvedValue(1),
    voucherSequence: {
      upsert: vi.fn().mockResolvedValue({
        id: 'seq-001',
        companyId: 'c-001',
        voucherType: 'SALES',
        financialYear: '2024-25',
        lastSequence: 0,
      }),
      findFirstOrThrow: vi.fn().mockResolvedValue({
        id: 'seq-001',
        companyId: 'c-001',
        voucherType: 'SALES',
        financialYear: '2024-25',
        lastSequence: 0,
      }),
      update: vi.fn().mockResolvedValue({
        id: 'seq-001',
        lastSequence: 1,
      }),
    },
    voucher: {
      create: vi.fn().mockResolvedValue(voucherCreateResult),
      update: vi.fn().mockResolvedValue({ ...voucherCreateResult, status: 'CANCELLED' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(voucherCreateResult),
      findMany: vi.fn().mockResolvedValue([]),
    },
    voucherItem: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    voucherEntry: {
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
      findMany: vi.fn().mockResolvedValue([
        { id: 'e-001', ledgerId: 'l-party', amount: new Decimal('11800'), drCr: 'DR', narration: null, billRef: null },
        { id: 'e-002', ledgerId: 'l-sales', amount: new Decimal('11800'), drCr: 'CR', narration: null, billRef: null },
      ]),
    },
    billRef: {
      create: vi.fn().mockResolvedValue({ id: 'br-001' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'br-001',
        outstandingAmount: new Decimal('11800'),
        settled: false,
      }),
      update: vi.fn().mockResolvedValue({ id: 'br-001' }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'al-001' }),
    },
    ledger: {
      findFirst: vi.fn().mockResolvedValue({ id: 'l-party', name: 'Test Party', gstin: '27XYZAB1234C1Z5', stateCode: '27' }),
    },
    gstTransaction: {
      create: vi.fn().mockResolvedValue({ id: 'gst-tx-1' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    company: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ gstin: '29ABCDE1234F1Z5', stateCode: '29' }),
    },
    stockBatch: {
      create: vi.fn().mockResolvedValue({ id: 'sb-001', remainingQty: new Decimal('10') }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: 'sb-001' }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    stockConsumption: {
      create: vi.fn().mockResolvedValue({ id: 'sc-001' }),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  }
}

/** Session fixture */
const session = {
  user: {
    companyId: 'c-001',
    id: 'u-001',
    stateCode: '29',
    name: 'Test User',
    email: 'test@example.com',
  },
}

// ─── validateBalance ──────────────────────────────────────────────────────────

describe('validateBalance', () => {
  it('does not throw when DR total equals CR total', () => {
    expect(() =>
      validateBalance([
        { amount: new Decimal('1000'), drCr: 'DR' },
        { amount: new Decimal('1000'), drCr: 'CR' },
      ])
    ).not.toThrow()
  })

  it('does not throw for multiple balanced entries', () => {
    expect(() =>
      validateBalance([
        { amount: new Decimal('10000'), drCr: 'DR' },
        { amount: new Decimal('8474.57'), drCr: 'CR' }, // taxable
        { amount: new Decimal('762.71'), drCr: 'CR' },  // CGST
        { amount: new Decimal('762.72'), drCr: 'CR' },  // SGST
      ])
    ).not.toThrow()
  })

  it('throws ValidationError when DR total does not equal CR total', () => {
    expect(() =>
      validateBalance([
        { amount: new Decimal('1000'), drCr: 'DR' },
        { amount: new Decimal('999'), drCr: 'CR' },
      ])
    ).toThrow(ValidationError)
  })

  it('includes exact DR and CR amounts in ValidationError message', () => {
    try {
      validateBalance([
        { amount: new Decimal('1000'), drCr: 'DR' },
        { amount: new Decimal('999'), drCr: 'CR' },
      ])
      // If no throw, fail the test
      expect.fail('Expected ValidationError to be thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      const msg = (err as ValidationError).message
      expect(msg).toContain('1000.00')
      expect(msg).toContain('999.00')
    }
  })

  it('ValidationError name is "ValidationError"', () => {
    try {
      validateBalance([
        { amount: new Decimal('500'), drCr: 'DR' },
        { amount: new Decimal('400'), drCr: 'CR' },
      ])
    } catch (err) {
      expect((err as ValidationError).name).toBe('ValidationError')
    }
  })

  it('throws ValidationError for empty entries array (zero DR and zero CR are equal but no entries is invalid)', () => {
    // CR-04 fix: empty entry set must throw — a voucher with no entries is invalid regardless
    // of 0 === 0 balance. Self-defending service layer prevents zero-value vouchers from persisting.
    expect(() => validateBalance([])).toThrow(ValidationError)
    expect(() => validateBalance([])).toThrow('A voucher must have at least one entry')
  })

  it('throws ValidationError when all entries have amount = 0 (zero-amount voucher)', () => {
    expect(() =>
      validateBalance([
        { amount: new Decimal('0'), drCr: 'DR' },
        { amount: new Decimal('0'), drCr: 'CR' },
      ])
    ).toThrow(ValidationError)
  })

  it('throws ValidationError when any single entry has amount = 0', () => {
    expect(() =>
      validateBalance([
        { amount: new Decimal('1000'), drCr: 'DR' },
        { amount: new Decimal('0'), drCr: 'CR' },
        { amount: new Decimal('1000'), drCr: 'CR' },
      ])
    ).toThrow(ValidationError)
  })
})

// ─── getNextVoucherNo ─────────────────────────────────────────────────────────

describe('getNextVoucherNo', () => {
  it('returns SI-2024-25-0001 for first SALES voucher in FY 2024-25', async () => {
    const tx = makeMockTx()
    const result = await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    expect(result).toBe('SI-2024-25-0001')
  })

  it('returns SI-2024-25-0002 when lastSequence was 1', async () => {
    const tx = makeMockTx({
      voucherSequence: {
        upsert: vi.fn().mockResolvedValue({
          id: 'seq-001',
          companyId: 'c-001',
          voucherType: 'SALES',
          financialYear: '2024-25',
          lastSequence: 1,
        }),
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: 'seq-001',
          companyId: 'c-001',
          voucherType: 'SALES',
          financialYear: '2024-25',
          lastSequence: 1,
        }),
        update: vi.fn().mockResolvedValue({ id: 'seq-001', lastSequence: 2 }),
      },
    })
    const result = await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    expect(result).toBe('SI-2024-25-0002')
  })

  it('zero-pads sequence number to 4 digits', async () => {
    const tx = makeMockTx({
      voucherSequence: {
        upsert: vi.fn().mockResolvedValue({
          id: 'seq-001',
          lastSequence: 99,
        }),
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: 'seq-001',
          lastSequence: 99,
        }),
        update: vi.fn().mockResolvedValue({ id: 'seq-001', lastSequence: 100 }),
      },
    })
    const result = await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    expect(result).toBe('SI-2024-25-0100')
  })

  it('uses correct type prefix for each voucher type', async () => {
    const types = [
      ['SALES', 'SI'],
      ['PURCHASE', 'PI'],
      ['RECEIPT', 'RV'],
      ['PAYMENT', 'PV'],
      ['JOURNAL', 'JV'],
      ['CONTRA', 'CV'],
      ['CREDIT_NOTE', 'CN'],
      ['DEBIT_NOTE', 'DN'],
    ] as const

    for (const [voucherType, prefix] of types) {
      const tx = makeMockTx()
      const result = await getNextVoucherNo(tx as any, 'c-001', voucherType, '2024-25')
      expect(result).toMatch(new RegExp(`^${prefix}-2024-25-`))
    }
  })

  it('does NOT call $executeRaw — SQLite $transaction is Serializable', async () => {
    const tx = makeMockTx()
    await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    // SQLite $transaction serializes automatically — no explicit row lock needed
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('calls voucherSequence.upsert to ensure row exists before locking', async () => {
    const tx = makeMockTx()
    await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    expect(tx.voucherSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId_voucherType_financialYear: expect.objectContaining({
            companyId: 'c-001',
            voucherType: 'SALES',
            financialYear: '2024-25',
          }),
        }),
      })
    )
  })

  it('calls voucherSequence.update to increment lastSequence', async () => {
    const tx = makeMockTx()
    await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    expect(tx.voucherSequence.update).toHaveBeenCalled()
  })

  it('two sequential calls with incrementing mock state return distinct voucher numbers', async () => {
    let callCount = 0
    const tx = makeMockTx({
      voucherSequence: {
        upsert: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            id: 'seq-001',
            companyId: 'c-001',
            voucherType: 'SALES',
            financialYear: '2024-25',
            lastSequence: callCount,
          })
        }),
        findFirstOrThrow: vi.fn().mockImplementation(() => {
          return Promise.resolve({
            id: 'seq-001',
            lastSequence: callCount,
          })
        }),
        update: vi.fn().mockImplementation(() => {
          callCount += 1
          return Promise.resolve({ id: 'seq-001', lastSequence: callCount })
        }),
      },
    })

    const first = await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    const second = await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')

    expect(first).toBe('SI-2024-25-0001')
    expect(second).toBe('SI-2024-25-0002')
    expect(first).not.toBe(second)
  })
})

// ─── createVoucher ────────────────────────────────────────────────────────────

describe('createVoucher', () => {
  let mockPrisma: {
    $transaction: ReturnType<typeof vi.fn>
  }
  let capturedTx: ReturnType<typeof makeMockTx>

  beforeEach(() => {
    capturedTx = makeMockTx()
    mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(capturedTx)
      }),
    }
  })

  const validSalesInput = {
    voucherType: 'SALES' as const,
    partyLedgerId: 'l-party',
    date: '2024-10-01',
    narration: 'Test sale',
    status: 'POSTED' as const,
    entries: [
      { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('11800') },
      { ledgerId: 'l-sales', drCr: 'CR' as const, amount: new Decimal('10000') },
      { ledgerId: 'l-cgst', drCr: 'CR' as const, amount: new Decimal('900') },
      { ledgerId: 'l-sgst', drCr: 'CR' as const, amount: new Decimal('900') },
    ],
    items: [],
  }

  it('calls voucher.create once with correct voucherType and POSTED status', async () => {
    await createVoucher(validSalesInput, session, mockPrisma as any)
    expect(capturedTx.voucher.create).toHaveBeenCalledOnce()
    expect(capturedTx.voucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          voucherType: 'SALES',
          status: 'POSTED',
          companyId: 'c-001',
        }),
      })
    )
  })

  it('calls auditLog.create once inside the same transaction (VOUCH-08)', async () => {
    await createVoucher(validSalesInput, session, mockPrisma as any)
    expect(capturedTx.auditLog.create).toHaveBeenCalledOnce()
    expect(capturedTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entity: 'Voucher',
          action: 'CREATE',
          companyId: 'c-001',
          userId: 'u-001',
        }),
      })
    )
  })

  it('calls billRef.create once for POSTED SALES voucher', async () => {
    await createVoucher(validSalesInput, session, mockPrisma as any)
    expect(capturedTx.billRef.create).toHaveBeenCalledOnce()
  })

  it('does NOT call billRef.create for DRAFT vouchers (Pitfall 4 — T-02-05)', async () => {
    const draftInput = { ...validSalesInput, status: 'DRAFT' as const }
    await createVoucher(draftInput, session, mockPrisma as any)
    expect(capturedTx.billRef.create).not.toHaveBeenCalled()
  })

  it('throws ValidationError before calling voucher.create when entries are unbalanced (T-02-01)', async () => {
    const unbalancedInput = {
      ...validSalesInput,
      entries: [
        { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('11800') },
        { ledgerId: 'l-sales', drCr: 'CR' as const, amount: new Decimal('9000') }, // deliberate mismatch
      ],
    }

    // createVoucher wraps everything in $transaction — the ValidationError
    // should propagate from inside the $transaction callback.
    await expect(
      createVoucher(unbalancedInput, session, mockPrisma as any)
    ).rejects.toThrow(ValidationError)

    // voucher.create must NOT have been called (balance check is first)
    expect(capturedTx.voucher.create).not.toHaveBeenCalled()
  })

  it('uses companyId from session, never from input (multi-tenant rule)', async () => {
    // Attempt to inject a companyId via the input object — VoucherEngine ignores it
    const inputWithFakeCompany = {
      ...validSalesInput,
      companyId: 'EVIL-COMPANY', // should be ignored; session.user.companyId wins
    }
    await createVoucher(inputWithFakeCompany, session, mockPrisma as any)
    expect(capturedTx.voucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'c-001' }), // session.user.companyId always wins
      })
    )
  })
})

// ─── cancelVoucher ────────────────────────────────────────────────────────────

describe('cancelVoucher', () => {
  let mockPrisma: {
    $transaction: ReturnType<typeof vi.fn>
  }
  let capturedTx: ReturnType<typeof makeMockTx>

  beforeEach(() => {
    capturedTx = makeMockTx()
    mockPrisma = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(capturedTx)
      }),
    }
  })

  it('calls voucher.update with status CANCELLED — never hard-deletes (VOUCH-09)', async () => {
    await cancelVoucher('v-001', session, mockPrisma as any)
    expect(capturedTx.voucher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'v-001', companyId: 'c-001' }),
        data: expect.objectContaining({ status: 'CANCELLED' }),
      })
    )
    // Confirm no delete was called
    expect((capturedTx.voucher as any).delete).toBeUndefined()
  })

  it('calls auditLog.create with action CANCEL inside the same transaction', async () => {
    await cancelVoucher('v-001', session, mockPrisma as any)
    expect(capturedTx.auditLog.create).toHaveBeenCalledOnce()
    expect(capturedTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CANCEL',
          entityId: 'v-001',
          companyId: 'c-001',
        }),
      })
    )
  })

  it('calls billRef.updateMany to restore outstanding amounts', async () => {
    await cancelVoucher('v-001', session, mockPrisma as any)
    expect(capturedTx.billRef.updateMany).toHaveBeenCalled()
    expect(capturedTx.billRef.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ voucherId: 'v-001', companyId: 'c-001' }),
        data: expect.objectContaining({ settled: false }),
      })
    )
  })

  it('reads the voucher first with companyId scoping (multi-tenant)', async () => {
    await cancelVoucher('v-001', session, mockPrisma as any)
    expect(capturedTx.voucher.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'v-001', companyId: 'c-001' }),
      })
    )
  })
})

// ─── createVoucher — bill-wise settlement ────────────────────────────────────

describe('createVoucher — bill-wise settlement', () => {
  const baseInput = {
    voucherType: 'RECEIPT' as const,
    partyLedgerId: 'l-party',
    date: '2024-10-01',
    status: 'POSTED' as const,
    entries: [
      { ledgerId: 'l-cash', drCr: 'DR' as const, amount: new Decimal('11800') },
      { ledgerId: 'l-party', drCr: 'CR' as const, amount: new Decimal('11800') },
    ],
  }

  it('calls billRef.update for each settlement item when status is POSTED', async () => {
    const tx = makeMockTx()
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher(
      { ...baseInput, settlements: [{ billRefId: 'br-001', amount: new Decimal('11800') }] },
      session,
      mockDb as any
    )

    expect(tx.billRef.findFirst).toHaveBeenCalledWith({
      where: { id: 'br-001', companyId: 'c-001' },
    })
    expect(tx.billRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'br-001' },
        data: expect.objectContaining({ settled: true }),
      })
    )
  })

  it('marks billRef settled=false when partial settlement leaves positive outstanding', async () => {
    const tx = makeMockTx({
      billRef: {
        create: vi.fn().mockResolvedValue({ id: 'br-new' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'br-001',
          outstandingAmount: new Decimal('20000'),
          settled: false,
        }),
        update: vi.fn().mockResolvedValue({ id: 'br-001' }),
      },
    })
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher(
      { ...baseInput, settlements: [{ billRefId: 'br-001', amount: new Decimal('11800') }] },
      session,
      mockDb as any
    )

    const updateCall = (tx.billRef.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.settled).toBe(false)
    expect(updateCall.data.outstandingAmount.toString()).toBe('8200')
  })

  it('throws ValidationError when billRefId not found (multi-tenant isolation)', async () => {
    const tx = makeMockTx({
      billRef: {
        create: vi.fn().mockResolvedValue({ id: 'br-new' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({ id: 'br-001' }),
      },
    })
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await expect(
      createVoucher(
        { ...baseInput, settlements: [{ billRefId: 'br-other', amount: new Decimal('5000') }] },
        session,
        mockDb as any
      )
    ).rejects.toThrow(ValidationError)
  })

  it('does not call billRef.update when settlements array is empty', async () => {
    const tx = makeMockTx()
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher({ ...baseInput, settlements: [] }, session, mockDb as any)

    expect(tx.billRef.update).not.toHaveBeenCalled()
  })
})

// ─── createVoucher — credit note outstanding reduction ───────────────────────

describe('createVoucher — credit note outstanding reduction', () => {
  it('decrements original BillRef outstandingAmount when CREDIT_NOTE posted with linkedVoucherId', async () => {
    const tx = makeMockTx({
      voucher: {
        create: vi.fn().mockResolvedValue({
          id: 'v-cn-001',
          companyId: 'c-001',
          voucherType: 'CREDIT_NOTE',
          voucherNo: 'CN-2024-25-0001',
          date: new Date('2024-10-15'),
          totalAmount: new Decimal('5000'),
          status: 'POSTED',
          partyLedgerId: 'l-party',
          createdBy: 'u-001',
        }),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      billRef: {
        create: vi.fn().mockResolvedValue({ id: 'br-cn-001' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'br-orig-001',
          outstandingAmount: new Decimal('11800'),
          settled: false,
        }),
        update: vi.fn().mockResolvedValue({ id: 'br-orig-001' }),
      },
    })
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher(
      {
        voucherType: 'CREDIT_NOTE',
        partyLedgerId: 'l-party',
        date: '2024-10-15',
        status: 'POSTED',
        linkedVoucherId: 'v-orig-001',
        entries: [
          { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('5000') },
          { ledgerId: 'l-sales', drCr: 'CR' as const, amount: new Decimal('5000') },
        ],
      },
      session,
      mockDb as any
    )

    expect(tx.billRef.findFirst).toHaveBeenCalledWith({
      where: { voucherId: 'v-orig-001', companyId: 'c-001' },
    })
    const updateCall = (tx.billRef.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.settled).toBe(false)
  })

  it('marks original BillRef settled=true when credit note fully covers the outstanding amount', async () => {
    const tx = makeMockTx({
      voucher: {
        create: vi.fn().mockResolvedValue({
          id: 'v-cn-002',
          companyId: 'c-001',
          voucherType: 'CREDIT_NOTE',
          voucherNo: 'CN-2024-25-0002',
          date: new Date('2024-10-20'),
          totalAmount: new Decimal('11800'),
          status: 'POSTED',
          partyLedgerId: 'l-party',
          createdBy: 'u-001',
        }),
        update: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      billRef: {
        create: vi.fn().mockResolvedValue({ id: 'br-cn-002' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'br-orig-002',
          outstandingAmount: new Decimal('11800'),
          settled: false,
        }),
        update: vi.fn().mockResolvedValue({ id: 'br-orig-002' }),
      },
    })
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher(
      {
        voucherType: 'CREDIT_NOTE',
        partyLedgerId: 'l-party',
        date: '2024-10-20',
        status: 'POSTED',
        linkedVoucherId: 'v-orig-002',
        entries: [
          { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('11800') },
          { ledgerId: 'l-sales', drCr: 'CR' as const, amount: new Decimal('11800') },
        ],
      },
      session,
      mockDb as any
    )

    const updateCall = (tx.billRef.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.settled).toBe(true)
  })
})

// ─── GstTransaction creation tests ──────────────────────────────────────────

describe('createVoucher — GstTransaction creation', () => {
  const basePostedSalesInput = {
    voucherType: 'SALES' as const,
    partyLedgerId: 'l-party',
    date: '2024-10-01',
    narration: 'Test sale',
    status: 'POSTED' as const,
    entries: [
      { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('11800') },
      { ledgerId: 'l-sales', drCr: 'CR' as const, amount: new Decimal('10000') },
      { ledgerId: 'l-cgst', drCr: 'CR' as const, amount: new Decimal('900') },
      { ledgerId: 'l-sgst', drCr: 'CR' as const, amount: new Decimal('900') },
    ],
    items: [],
  }

  it('Test 1: createVoucher with SALES + POSTED calls tx.gstTransaction.create once with correct returnPeriod', async () => {
    const tx = makeMockTx()
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher(basePostedSalesInput, session, mockDb as any)

    expect(tx.gstTransaction.create).toHaveBeenCalledOnce()
    // returnPeriod should be "10/2024" for October 2024
    expect(tx.gstTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'c-001',
          returnPeriod: '10/2024',
          gstr1Status: 'PENDING',
          gstr3bStatus: 'PENDING',
        }),
      })
    )
  })

  it('Test 2: createVoucher with DRAFT status does NOT call tx.gstTransaction.create', async () => {
    const tx = makeMockTx()
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher({ ...basePostedSalesInput, status: 'DRAFT' }, session, mockDb as any)

    expect(tx.gstTransaction.create).not.toHaveBeenCalled()
  })

  it('Test 3: createVoucher with RECEIPT type does NOT call tx.gstTransaction.create', async () => {
    const tx = makeMockTx()
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    const receiptInput = {
      voucherType: 'RECEIPT' as const,
      partyLedgerId: 'l-party',
      date: '2024-10-01',
      status: 'POSTED' as const,
      entries: [
        { ledgerId: 'l-cash', drCr: 'DR' as const, amount: new Decimal('11800') },
        { ledgerId: 'l-party', drCr: 'CR' as const, amount: new Decimal('11800') },
      ],
      items: [],
    }

    await createVoucher(receiptInput, session, mockDb as any)

    expect(tx.gstTransaction.create).not.toHaveBeenCalled()
  })

  it('Test 4: createVoucher with CREDIT_NOTE + POSTED calls tx.gstTransaction.create (CDNR)', async () => {
    const tx = makeMockTx({
      voucher: {
        create: vi.fn().mockResolvedValue({
          id: 'v-cn-001',
          companyId: 'c-001',
          voucherType: 'CREDIT_NOTE',
          voucherNo: 'CN-2024-25-0001',
          date: new Date('2024-10-01'),
          totalAmount: new Decimal('5000'),
          status: 'POSTED',
          partyLedgerId: 'l-party',
          createdBy: 'u-001',
        }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    })
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher(
      {
        voucherType: 'CREDIT_NOTE',
        partyLedgerId: 'l-party',
        date: '2024-10-01',
        status: 'POSTED',
        linkedVoucherId: 'v-orig-001',
        entries: [
          { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('5000') },
          { ledgerId: 'l-sales', drCr: 'CR' as const, amount: new Decimal('5000') },
        ],
        items: [],
      },
      session,
      mockDb as any
    )

    expect(tx.gstTransaction.create).toHaveBeenCalledOnce()
  })

  it('Test 5: postVoucher on a SALES voucher without existing GstTransaction calls tx.gstTransaction.create', async () => {
    const tx = makeMockTx({
      voucher: {
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'v-001', status: 'POSTED', totalAmount: new Decimal('11800'), partyLedgerId: 'l-party' }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'v-001',
          companyId: 'c-001',
          voucherType: 'SALES',
          voucherNo: 'SI-2024-25-0001',
          date: new Date('2024-10-01'),
          totalAmount: new Decimal('11800'),
          status: 'DRAFT',
          partyLedgerId: 'l-party',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      // gstTransaction.findFirst returns null → no existing row
      gstTransaction: {
        create: vi.fn().mockResolvedValue({ id: 'gst-tx-1' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    })
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await postVoucher('v-001', session, mockDb as any)

    expect(tx.gstTransaction.findFirst).toHaveBeenCalledWith({ where: { voucherId: 'v-001', companyId: 'c-001' } })
    expect(tx.gstTransaction.create).toHaveBeenCalledOnce()
  })

  it('Test 6: postVoucher when GstTransaction already exists does NOT create a duplicate', async () => {
    const tx = makeMockTx({
      voucher: {
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'v-001', status: 'POSTED', totalAmount: new Decimal('11800'), partyLedgerId: 'l-party' }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'v-001',
          companyId: 'c-001',
          voucherType: 'SALES',
          voucherNo: 'SI-2024-25-0001',
          date: new Date('2024-10-01'),
          totalAmount: new Decimal('11800'),
          status: 'DRAFT',
          partyLedgerId: 'l-party',
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      // gstTransaction.findFirst returns existing row → duplicate guard fires
      gstTransaction: {
        create: vi.fn().mockResolvedValue({ id: 'gst-tx-1' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'gst-tx-existing' }),
      },
    })
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await postVoucher('v-001', session, mockDb as any)

    expect(tx.gstTransaction.findFirst).toHaveBeenCalledOnce()
    expect(tx.gstTransaction.create).not.toHaveBeenCalled()
  })

  it('Test 7: createVoucher with tdsSection persists tdsSection on voucher.create data', async () => {
    const tx = makeMockTx()
    const mockDb = { $transaction: vi.fn((fn) => fn(tx)) }

    await createVoucher(
      {
        ...basePostedSalesInput,
        voucherType: 'PAYMENT',
        entries: [
          { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('50000') },
          { ledgerId: 'l-bank', drCr: 'CR' as const, amount: new Decimal('45000') },
          { ledgerId: 'l-tds', drCr: 'CR' as const, amount: new Decimal('5000') },
        ],
        items: [],
        tdsSection: '194J',
        tdsRate: new Decimal('10'),
        tdsAmount: new Decimal('5000'),
      },
      session,
      mockDb as any
    )

    expect(tx.voucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tdsSection: '194J',
          tdsRate: new Decimal('10'),
          tdsAmount: new Decimal('5000'),
        }),
      })
    )
  })
})

// ─── getNextVoucherNo — concurrent lock guard ────────────────────────────────

describe('getNextVoucherNo — concurrent lock guard', () => {
  it('does NOT call $executeRaw on any invocation — SQLite serializes $transaction', async () => {
    const tx = makeMockTx()

    // Call getNextVoucherNo twice on the same tx instance
    await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')
    await getNextVoucherNo(tx as any, 'c-001', 'SALES', '2024-25')

    // SQLite $transaction is Serializable — no explicit row lock needed on any invocation
    expect(tx.$executeRaw).not.toHaveBeenCalled()
  })

  it('two concurrent invocations each increment lastSequence independently (mock simulation)', async () => {
    // Each tx is an independent mock — stateless, each starting from lastSequence=0.
    // This validates that per-tx isolation is consistent; in production SQLite's
    // Serializable $transaction prevents duplicate sequence numbers across concurrent transactions.
    const tx1 = makeMockTx()
    const tx2 = makeMockTx()

    const result1 = await getNextVoucherNo(tx1 as any, 'c-001', 'SALES', '2024-25')
    const result2 = await getNextVoucherNo(tx2 as any, 'c-001', 'SALES', '2024-25')

    // Both independent tx mocks start at lastSequence=0 and produce SI-2024-25-0001
    expect(result1).toBe('SI-2024-25-0001')
    expect(result2).toBe('SI-2024-25-0001')
  })
})

// ─── createVoucher — Credit Note full close ──────────────────────────────────

describe('createVoucher — Credit Note full close', () => {
  it('billRef.update sets outstandingAmount to Decimal("0") and settled=true when credit note exactly covers outstanding', async () => {
    const tx = makeMockTx({
      voucher: {
        create: vi.fn().mockResolvedValue({
          id: 'v-cn-full',
          companyId: 'c-001',
          voucherType: 'CREDIT_NOTE',
          voucherNo: 'CN-2024-25-0010',
          date: new Date('2024-11-01'),
          totalAmount: new Decimal('5000'),
          status: 'POSTED',
          partyLedgerId: 'l-party',
          createdBy: 'u-001',
        }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      billRef: {
        create: vi.fn().mockResolvedValue({ id: 'br-cn-full' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        // Original bill has outstandingAmount exactly equal to the credit note total (5000)
        findFirst: vi.fn().mockResolvedValue({
          id: 'br-full',
          outstandingAmount: new Decimal('5000'),
          settled: false,
        }),
        update: vi.fn().mockResolvedValue({ id: 'br-full' }),
      },
    })
    const mockDb = { $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) }

    await createVoucher(
      {
        voucherType: 'CREDIT_NOTE',
        partyLedgerId: 'l-party',
        date: '2024-11-01',
        status: 'POSTED',
        linkedVoucherId: 'v-orig',
        entries: [
          { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('5000') },
          { ledgerId: 'l-sales', drCr: 'CR' as const, amount: new Decimal('5000') },
        ],
      },
      session,
      mockDb as any
    )

    const updateCall = (tx.billRef.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    // When credit note exactly covers the outstanding, settled=true and outstandingAmount=0
    expect(updateCall.data.settled).toBe(true)
    expect(updateCall.data.outstandingAmount.toString()).toBe('0')
  })
})

// ─── createVoucher — TDS 194C section ────────────────────────────────────────

describe('createVoucher — TDS 194C section', () => {
  it('createVoucher with tdsSection 194C persists tdsSection, tdsRate, tdsAmount on voucher.create', async () => {
    const tx = makeMockTx()
    const mockDb = { $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)) }

    // PAYMENT voucher: gross 50000 DR to party, 49500 CR to bank + 500 CR to TDS Payable
    await createVoucher(
      {
        voucherType: 'PAYMENT',
        partyLedgerId: 'l-party',
        date: '2024-10-01',
        status: 'POSTED',
        narration: 'Payment to contractor TDS 194C',
        entries: [
          { ledgerId: 'l-party', drCr: 'DR' as const, amount: new Decimal('50000') },
          { ledgerId: 'l-bank', drCr: 'CR' as const, amount: new Decimal('49500') },
          { ledgerId: 'l-tds-payable', drCr: 'CR' as const, amount: new Decimal('500') },
        ],
        items: [],
        tdsSection: '194C',
        tdsRate: new Decimal('1'),
        tdsAmount: new Decimal('500'),
      },
      session,
      mockDb as any
    )

    expect(tx.voucher.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tdsSection: '194C',
          tdsRate: new Decimal('1'),
          tdsAmount: new Decimal('500'),
        }),
      })
    )
  })
})
