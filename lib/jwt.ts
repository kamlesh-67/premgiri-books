/**
 * lib/jwt.ts — JWT sign and verify wrappers using jose.
 *
 * Used by:
 *   - app/api/v1/auth/login/route.ts (signJWT on successful login)
 *   - lib/session.ts (verifyJWT to extract session from cookie)
 *   - middleware.ts (jwtVerify directly from jose — same secret)
 *
 * Plans 02 and 03 depend on the exact export names and JWTPayload shape defined here.
 */
import { SignJWT, jwtVerify } from 'jose'

const ALGORITHM = 'HS256'
const EXPIRY = '7d'

/** Lazily read JWT_SECRET so tests can set process.env before calling sign/verify. */
function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('JWT_SECRET must be defined and at least 32 characters long')
  }
  return new TextEncoder().encode(raw)
}

export interface JWTPayload {
  userId: string
  companyId: string
  roleId: string | null
  /** Role name (e.g. "Admin") — required by AUTH-04 */
  role: string
  uiMode: 'simple' | 'advanced'
  permissions: Record<string, string[]>
}

/**
 * Sign a JWTPayload with HS256, 7-day expiry.
 * Returns a compact JWT string.
 */
export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret())
}

/**
 * Verify a JWT token and return the payload.
 * Returns null (never throws) for invalid, expired, or tampered tokens.
 */
export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}
