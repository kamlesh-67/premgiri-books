import { describe, it, expect, beforeEach } from 'vitest'
import { signJWT, verifyJWT, type JWTPayload } from '@/lib/jwt'

const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long'

const samplePayload: JWTPayload = {
  userId: 'user-123',
  companyId: 'company-456',
  roleId: 'role-789',
  role: 'Admin',
  uiMode: 'advanced',
  permissions: { invoices: ['read', 'write'], reports: ['read'] },
}

beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET
})

describe('signJWT + verifyJWT', () => {
  it('roundtrip: verifyJWT returns the same payload that was signed', async () => {
    const token = await signJWT(samplePayload)
    const result = await verifyJWT(token)

    expect(result).not.toBeNull()
    expect(result?.userId).toBe(samplePayload.userId)
    expect(result?.companyId).toBe(samplePayload.companyId)
    expect(result?.roleId).toBe(samplePayload.roleId)
    expect(result?.role).toBe(samplePayload.role)
    expect(result?.uiMode).toBe(samplePayload.uiMode)
    expect(result?.permissions).toEqual(samplePayload.permissions)
  })

  it('payload includes the role field (AUTH-04)', async () => {
    const token = await signJWT(samplePayload)
    const result = await verifyJWT(token)

    expect(result).not.toBeNull()
    expect(result?.role).toBe('Admin')
  })

  it('verifyJWT with a tampered token returns null', async () => {
    const token = await signJWT(samplePayload)
    // Tamper the signature part
    const parts = token.split('.')
    const tampered = parts[0] + '.' + parts[1] + '.invalidsignatureXXX'
    const result = await verifyJWT(tampered)

    expect(result).toBeNull()
  })

  it('verifyJWT with a completely invalid string returns null', async () => {
    const result = await verifyJWT('not.a.jwt')
    expect(result).toBeNull()
  })

  it('verifyJWT with an empty string returns null', async () => {
    const result = await verifyJWT('')
    expect(result).toBeNull()
  })

  it('verifyJWT with null roleId preserves null', async () => {
    const payload: JWTPayload = { ...samplePayload, roleId: null }
    const token = await signJWT(payload)
    const result = await verifyJWT(token)

    expect(result?.roleId).toBeNull()
  })

  it('signJWT returns a compact JWT string with three dot-separated parts', async () => {
    const token = await signJWT(samplePayload)
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })
})
