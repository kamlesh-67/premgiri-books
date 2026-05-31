/**
 * lib/jwt.ts — JWT utilities for first-run setup and programmatic session creation.
 *
 * WHY THIS EXISTS: The first-run setup wizard (POST /api/v1/setup) needs to issue
 * a session cookie immediately after creating the admin user, before NextAuth's
 * CredentialsProvider flow can run (no login form in the wizard).
 *
 * signJWT uses next-auth/jwt encode to produce a NextAuth-compatible session token,
 * which the existing middleware.ts auth() call recognises without modification.
 *
 * The cookie name and signing secret must match NextAuth's configuration exactly:
 *   - Cookie: authjs.session-token  (NextAuth v5 default)
 *   - Secret: process.env.AUTH_SECRET
 *   - Algorithm: HS256 (next-auth/jwt default)
 *
 * DO NOT use this for anything other than the setup wizard. Normal auth uses
 * NextAuth's CredentialsProvider which calls signIn() from the login page.
 */
import { encode } from 'next-auth/jwt'

export interface JWTPayload {
  userId: string
  companyId: string
  roleId: string | null
  role: string
  uiMode: 'simple' | 'advanced'
  permissions: Record<string, string[]>
}

/**
 * Signs a NextAuth-compatible JWT session token.
 * The returned token can be set as the `authjs.session-token` cookie.
 */
export async function signJWT(payload: JWTPayload): Promise<string> {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required')
  }

  const cookieName = SESSION_COOKIE_NAME

  return encode({
    token: {
      // NextAuth standard fields
      sub: payload.userId,
      // Custom fields read by auth.config.ts callbacks.session
      userId: payload.userId,
      companyId: payload.companyId,
      roleId: payload.roleId,
      role: payload.role,
      uiMode: payload.uiMode,
      permissions: payload.permissions,
    },
    secret,
    // salt must equal the cookie name — this is how @auth/core derives the encryption key
    salt: cookieName,
    // 7-day expiry — matches the cookie maxAge in POST /api/v1/setup
    maxAge: 60 * 60 * 24 * 7,
  })
}

/**
 * NextAuth v5 session cookie name (matches the default in next-auth@5 beta).
 * Production uses __Secure-authjs.session-token; dev uses authjs.session-token.
 */
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production'
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token'
