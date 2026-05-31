/**
 * lib/session.ts — Session helpers for reading the JWT from the auth-token cookie.
 *
 * getSessionFromRequest: use in API route handlers (reads from NextRequest.cookies)
 * readSession: use in Server Components and layouts (reads from next/headers cookies())
 *
 * Both return null if the cookie is absent or the token is invalid/expired.
 */
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { verifyJWT, type JWTPayload } from '@/lib/jwt'

/**
 * Read and verify the auth-token cookie from a NextRequest.
 * Use this in API route handlers as a replacement for auth() from NextAuth.
 */
export async function getSessionFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get('auth-token')?.value
  if (!token) return null
  return verifyJWT(token)
}

/**
 * Read and verify the auth-token cookie from next/headers.
 * Use this in Server Components, layouts, and server actions.
 */
export async function readSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyJWT(token)
}
