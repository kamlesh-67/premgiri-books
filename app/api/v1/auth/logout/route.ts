/**
 * POST /api/v1/auth/logout
 *
 * Clears the auth-token cookie by setting maxAge: 0.
 * Does not require authentication — clearing an absent cookie is a no-op.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
