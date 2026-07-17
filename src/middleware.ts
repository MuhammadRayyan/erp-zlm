// ============================================================
// MIDDLEWARE — Global API route protection
// ============================================================
// Runs on every /api/* request (except public auth routes).
// Verifies JWT cryptographic signature using jose (Edge-compatible).
// If token is missing, invalid, or expired → returns 401.
//
// Public routes (no auth required):
// - /api/auth/login
// - /api/auth/register
// - /api/auth/logout
// - /api/init
// ============================================================

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
  const secret = process.env.JWT_SECRET || 'dev-fallback-do-not-use-in-production'
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
    const { payload } = await jwtVerify(sessionCookie, secret)

    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)
    
    // Role-based Access Control (RBAC) Enforcement
    if (payload.tenantRole === 'VIEWER') {
      console.log("[MIDDLEWARE] Viewer detected for mutation:", req.method, pathname);
      if (isMutation && !pathname.startsWith('/api/templates/preview')) {
        console.log("[MIDDLEWARE] BLOCKING VIEWER");
        return NextResponse.json({ error: 'Unauthorized: Viewers have read-only access' }, { status: 403 })
      }
    }

    if (payload.tenantRole === 'ACCOUNTANT') {
      const restrictedPrefixes = ['/api/tenant', '/api/settings', '/api/custom-fields', '/api/templates', '/api/tax-rates']
      if (restrictedPrefixes.some(p => pathname.startsWith(p)) && !pathname.startsWith('/api/templates/preview')) {
        const isStrictPrefix = pathname.startsWith('/api/tenant') || pathname.startsWith('/api/settings');
        if (isMutation || isStrictPrefix) {
          console.log("[MIDDLEWARE] BLOCKING ACCOUNTANT");
          return NextResponse.json({ error: 'Unauthorized: Accountants cannot access or modify configuration' }, { status: 403 })
        }
      }
    }
  } catch (error) {
    console.error("[MIDDLEWARE] Error verifying JWT:", error);
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
