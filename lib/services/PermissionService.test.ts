import { describe, it, expect } from 'vitest'
import { hasPermission } from './PermissionService'

describe('hasPermission', () => {
  it('returns true when resource and action both present', () => {
    expect(hasPermission({ vouchers: ['read', 'write'] }, 'vouchers', 'read')).toBe(true)
  })
  it('returns false when action is missing from resource array', () => {
    expect(hasPermission({ vouchers: ['read'] }, 'vouchers', 'write')).toBe(false)
  })
  it('returns false when resource is absent from permissions', () => {
    expect(hasPermission({}, 'vouchers', 'read')).toBe(false)
  })
  it('returns false when permissions is null', () => {
    expect(hasPermission(null, 'vouchers', 'read')).toBe(false)
  })
  it('returns false when permissions is undefined', () => {
    expect(hasPermission(undefined, 'vouchers', 'read')).toBe(false)
  })
})
