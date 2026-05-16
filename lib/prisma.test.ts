import { describe, it, expect } from 'vitest'
import { guardTenantScope, TenantScopeError } from './prisma'

describe('guardTenantScope', () => {
  it('throws TenantScopeError when companyId is missing on tenant-scoped model', () => {
    expect(() => guardTenantScope('Ledger', 'findMany', { where: {} })).toThrow(TenantScopeError)
  })

  it('throws TenantScopeError when where clause is undefined', () => {
    expect(() => guardTenantScope('Voucher', 'findFirst', {})).toThrow(TenantScopeError)
  })

  it('does NOT throw when companyId is present', () => {
    expect(() =>
      guardTenantScope('Ledger', 'findMany', { where: { companyId: 'co_1' } })
    ).not.toThrow()
  })

  it('does NOT throw for non-tenant-scoped models', () => {
    expect(() => guardTenantScope('Company', 'findMany', { where: {} })).not.toThrow()
  })

  it('does NOT throw for non-guarded operations even when companyId is missing', () => {
    expect(() => guardTenantScope('Ledger', 'create', {})).not.toThrow()
  })
})

describe('TenantScopeError', () => {
  it('has the correct name and message format', () => {
    const error = new TenantScopeError('Ledger', 'findMany')
    expect(error.name).toBe('TenantScopeError')
    expect(error.message).toContain('Ledger.findMany')
    expect(error.message).toContain('companyId')
    expect(error).toBeInstanceOf(Error)
  })

  it('is distinguishable from a generic Error', () => {
    const error = new TenantScopeError('Voucher', 'update')
    expect(error instanceof TenantScopeError).toBe(true)
    expect(error instanceof Error).toBe(true)
  })
})
