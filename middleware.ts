/**
 * middleware.ts — Edge JWT verification using jose directly.
 *
 * Reads the auth-token httpOnly cookie, verifies it with jose jwtVerify,
 * and injects x-company-id, x-user-id, x-ui-mode headers for Server Components.
 *
 * Unauthenticated requests:
 *  - API paths (/api/*) → 401 JSON { error: 'Unauthorized' }
 *  - Page paths → redirect to /login?callbackUrl=<pathname>
 *
 * Public paths (never blocked):
 *  - /login, /api/v1/auth/login, /api/v1/auth/logout, /dev, /setup, /api/v1/setup
 */
import { jwtVerify } from 'jose'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Computed once at module load — JWT_SECRET must be present in the edge environment.
const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const { pathname } = request.nextUrl

  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/v1/auth/login') ||
    pathname.startsWith('/api/v1/auth/logout') ||
    pathname.startsWith('/dev') ||
    pathname.startsWith('/setup') ||
    pathname.startsWith('/api/v1/setup')

  // No token and not a public path → block
  if (!token && !isPublicPath) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Token present → verify and inject headers
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret)
      const response = NextResponse.next()
      response.headers.set('x-company-id', (payload.companyId as string) ?? '')
      response.headers.set('x-user-id', (payload.userId as string) ?? '')
      // Prefer the ui-mode cookie (set by /api/v1/user/preferences) over the JWT value
      const uiModeCookie = request.cookies.get('ui-mode')?.value
      const uiMode =
        uiModeCookie === 'simple' || uiModeCookie === 'advanced'
          ? uiModeCookie
          : ((payload.uiMode as string) ?? 'simple')
      response.headers.set('x-ui-mode', uiMode)
      return response
    } catch {
      // Token invalid or expired — treat as unauthenticated
      if (!isPublicPath) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
