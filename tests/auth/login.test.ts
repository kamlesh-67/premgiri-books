/**
 * Integration tests for POST /api/v1/auth/login
 *
 * Tests AUTH-01 requirements:
 *  - Valid credentials → 200 + httpOnly auth-token cookie
 *  - Wrong password → 401, no cookie
 *  - Inactive user → 401, no cookie
 *  - Non-existent email → 401, no cookie
 *  - Missing fields → 400, no cookie
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Set JWT_SECRET before importing the route (must be >= 32 chars)
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'

// Mock authDb before importing the route
vi.mock('@/lib/authDb', () => ({
  authDb: {
    user: {
      findFirst: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}))

import { POST } from '@/app/api/v1/auth/login/route'
import { authDb } from '@/lib/authDb'
import bcrypt from 'bcryptjs'

const mockUser = {
  id: 'user-123',
  companyId: 'company-456',
  roleId: 'role-789',
  uiMode: 'advanced',
  passwordHash: '$2a$12$hashedpassword',
}

const mockRole = {
  name: 'Admin',
  permissions: { invoices: ['read', 'write'] },
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/v1/auth/login', () => {
  it('valid credentials: returns 200 and sets httpOnly auth-token cookie', async () => {
    vi.mocked(authDb.user.findFirst).mockResolvedValue(mockUser as never)
    vi.mocked(authDb.role.findUnique).mockResolvedValue(mockRole as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

    const response = await POST(makeRequest({ email: 'user@example.com', password: 'correct' }))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).not.toBeNull()
    expect(setCookie).toContain('auth-token=')
    expect(setCookie?.toLowerCase()).toContain('httponly')
  })

  it('wrong password: returns 401 with no Set-Cookie header', async () => {
    vi.mocked(authDb.user.findFirst).mockResolvedValue(mockUser as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

    const response = await POST(makeRequest({ email: 'user@example.com', password: 'wrong' }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Incorrect email or password')

    // Should not set auth-token cookie on failure
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('inactive user: returns 401 with no Set-Cookie header', async () => {
    // findFirst returns null because isActive: true filter excludes inactive users
    vi.mocked(authDb.user.findFirst).mockResolvedValue(null)

    const response = await POST(makeRequest({ email: 'inactive@example.com', password: 'password' }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Incorrect email or password')

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('non-existent email: returns 401 with no Set-Cookie header', async () => {
    vi.mocked(authDb.user.findFirst).mockResolvedValue(null)

    const response = await POST(makeRequest({ email: 'nobody@example.com', password: 'anything' }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Incorrect email or password')

    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('missing email field: returns 400', async () => {
    const response = await POST(makeRequest({ password: 'password123' }))

    expect(response.status).toBe(400)
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('missing password field: returns 400', async () => {
    const response = await POST(makeRequest({ email: 'user@example.com' }))

    expect(response.status).toBe(400)
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toBeNull()
  })

  it('invalid email format: returns 400', async () => {
    const response = await POST(makeRequest({ email: 'not-an-email', password: 'password' }))

    expect(response.status).toBe(400)
  })

  it('empty body: returns 400', async () => {
    const response = await POST(makeRequest({}))
    expect(response.status).toBe(400)
  })
})
