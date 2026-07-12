import { NextRequest, NextResponse } from 'next/server'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/init',
]

// Check if a path is public
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip non-API routes (let Next.js handle page rendering)
  // The client-side auth check handles page-level protection
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public API routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // For all other API routes, check for session cookie
  const sessionCookie = req.cookies.get('accounterp_session')?.value

  if (!sessionCookie) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // Verify JWT token (defense-in-depth — routes also check via getSession)
  try {
    const secret = process.env.JWT_SECRET || 'dev-only-secret-not-for-production'
    // Basic verification — full verification happens in getSession()
    // We just check the token exists and is well-formed here
    const parts = sessionCookie.split('.')
    if (parts.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid session' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  // Run middleware on all API routes except auth public routes
  matcher: '/api/:path*',
}
