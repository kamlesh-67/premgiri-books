import { describe, it, expect, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
  resolveTdsPayableLedger,
  buildPaymentEntries,
  buildReceiptEntries,
} from '@/lib/services/VoucherEngine'

// ─── resolveTdsPayableLedger ──────────────────────────────────────────────────

describe('resolveTdsPayableLedger', () => {
  it('returns existing ledger id without creating anything', async () => {
    const mockPrisma = {
      ledger: {
        findFirst: vi.fn().mockResolvedValue({ id: 'ledger-existing' }),
        create: vi.fn(),
      },
      accountGroup: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    }

    const result = await resolveTdsPayableLedger(mockPrisma as any, 'company-1')

    expect(result).toBe('ledger-existing')
    expect(mockPrisma.ledger.create).not.toHaveBeenCalled()
    expect(mockPrisma.accountGroup.findFirst).not.toHaveBeenCalled()
  })

  it('creates ledger under existing group when ledger is absent', async () => {
    const mockPrisma = {
      ledger: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'ledger-new' }),
      },
      accountGroup: {
        findFirst: vi.fn().mockResolvedValue({ id: 'group-existing' }),
        create: vi.fn(),
      },
    }

    const result = await resolveTdsPayableLedger(mockPrisma as any, 'company-1')

    expect(result).toBe('ledger-new')
    expect(mockPrisma.accountGroup.create).not.toHaveBeenCalled()
    expect(mockPrisma.ledger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        name: 'TDS Payable',
        groupId: 'group-existing',
        drCr: 'CR',
        isActive: true,
      }),
    })
  })

  it('creates both AccountGroup and ledger when both are absent', async () => {
    const mockPrisma = {
      ledger: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'ledger-created' }),
      },
      accountGroup: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'group-created' }),
      },
    }

    const result = await resolveTdsPayableLedger(mockPrisma as any, 'company-1')

    expect(result).toBe('ledger-created')
    expect(mockPrisma.accountGroup.create).toHaveBeenCalledWith({
      data: {
        companyId: 'company-1',
        name: 'Current Liabilities',
        nature: 'LIABILITY',
        isSystem: false,
      },
    })
    expect(mockPrisma.ledger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        name: 'TDS Payable',
        groupId: 'group-created',
        drCr: 'CR',
        isActive: true,
      }),
    })
  })
})

// ─── buildPaymentEntries ──────────────────────────────────────────────────────

describe('buildPaymentEntries', () => {
  it('builds two-leg entries (no TDS): DR total equals CR total', () => {
    const gross = new Decimal('10000')
    const entries = buildPaymentEntries('party-1', 'bank-1', gross, null, null)

    expect(entries).toHaveLength(2)
    const drTotal = entries.filter((e) => e.drCr === 'DR').reduce((s, e) => s.plus(e.amount), new Decimal(0))
    const crTotal = entries.filter((e) => e.drCr === 'CR').reduce((s, e) => s.plus(e.amount), new Decimal(0))
    expect(drTotal.equals(crTotal)).toBe(true)
    expect(drTotal.toString()).toBe('10000')
    expect(entries[0]).toMatchObject({ ledgerId: 'party-1', drCr: 'DR' })
    expect(entries[1]).toMatchObject({ ledgerId: 'bank-1', drCr: 'CR' })
  })

  it('builds three-leg entries with TDS: DR(gross) === CR(net + tds)', () => {
    const gross = new Decimal('100000')
    const tds = new Decimal('2000')
    const entries = buildPaymentEntries('party-1', 'bank-1', gross, 'tds-ledger-1', tds)

    expect(entries).toHaveLength(3)
    const drTotal = entries.filter((e) => e.drCr === 'DR').reduce((s, e) => s.plus(e.amount), new Decimal(0))
    const crTotal = entries.filter((e) => e.drCr === 'CR').reduce((s, e) => s.plus(e.amount), new Decimal(0))
    expect(drTotal.equals(crTotal)).toBe(true)
    expect(drTotal.toString()).toBe('100000')

    const tdsEntry = entries.find((e) => e.ledgerId === 'tds-ledger-1')
    expect(tdsEntry).toBeDefined()
    expect(tdsEntry!.drCr).toBe('CR')
    expect(tdsEntry!.amount.toString()).toBe('2000')

    const bankEntry = entries.find((e) => e.ledgerId === 'bank-1')
    expect(bankEntry!.amount.toString()).toBe('98000')
  })

  it('treats zero tdsAmount as no TDS (two-leg)', () => {
    const gross = new Decimal('50000')
    const entries = buildPaymentEntries('party-1', 'bank-1', gross, 'tds-ledger-1', new Decimal(0))

    expect(entries).toHaveLength(2)
  })

  it('treats null tdsPayableLedgerId as no TDS (two-leg)', () => {
    const gross = new Decimal('50000')
    const entries = buildPaymentEntries('party-1', 'bank-1', gross, null, new Decimal('1000'))

    expect(entries).toHaveLength(2)
  })
})

// ─── buildReceiptEntries ──────────────────────────────────────────────────────

describe('buildReceiptEntries', () => {
  it('builds two-leg entries: Dr Bank, Cr Party — SUM(DR) === SUM(CR)', () => {
    const amount = new Decimal('25000')
    const entries = buildReceiptEntries('bank-1', 'party-1', amount)

    expect(entries).toHaveLength(2)
    const drTotal = entries.filter((e) => e.drCr === 'DR').reduce((s, e) => s.plus(e.amount), new Decimal(0))
    const crTotal = entries.filter((e) => e.drCr === 'CR').reduce((s, e) => s.plus(e.amount), new Decimal(0))
    expect(drTotal.equals(crTotal)).toBe(true)
    expect(drTotal.toString()).toBe('25000')
    expect(entries[0]).toMatchObject({ ledgerId: 'bank-1', drCr: 'DR' })
    expect(entries[1]).toMatchObject({ ledgerId: 'party-1', drCr: 'CR' })
  })
})
