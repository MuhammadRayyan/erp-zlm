import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

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

// Get JWT secret as Uint8Array for jose
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'dev-only-secret-not-for-production'
  return new TextEncoder().encode(secret)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip non-API routes (client-side auth handles page-level protection)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public API routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // For all other API routes, verify session cookie
  const sessionCookie = req.cookies.get('accounterp_session')?.value

  if (!sessionCookie) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  // Verify JWT cryptographic signature using jose (Edge-compatible)
  try {
    const secret = getJwtSecret()
    await jwtVerify(sessionCookie, secret)
  } catch {
    // Token is invalid, expired, or signature doesn't match
    return NextResponse.json(
      { error: 'Invalid or expired session' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  // Run middleware on all API routes
  matcher: '/api/:path*',
}
