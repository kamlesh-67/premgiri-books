import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  // Public paths — never redirect, never block
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/company-select') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/dev')

  // Block unauthenticated access to app pages
  if (!session && !isPublicPath) {
    // API routes return 401 JSON
    if (pathname.startsWith('/api/v1')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Page routes redirect to login with callbackUrl
    // NOTE: callbackUrl is always an internal pathname (starts with '/') — no open redirect risk
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Inject session data into headers for Server Components
  // (RSCs can read these without calling auth() again)
  const response = NextResponse.next()
  if (session?.user) {
    response.headers.set('x-company-id', session.user.companyId ?? '')
    response.headers.set('x-user-id', session.user.id ?? '')
    // Prefer the ui-mode cookie (set by /api/v1/user/preferences) over the JWT value,
    // since the JWT may be stale until the next sign-in.
    const uiModeCookie = request.cookies.get('ui-mode')?.value
    const uiMode = (uiModeCookie === 'simple' || uiModeCookie === 'advanced')
      ? uiModeCookie
      : (session.user.uiMode ?? 'simple')
    response.headers.set('x-ui-mode', uiMode)
  }

  return response
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
