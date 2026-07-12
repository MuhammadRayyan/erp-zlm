import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { db } from './db'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL: JWT_SECRET environment variable must be set in production. Set it in your .env file or environment.')
}
const SECRET = JWT_SECRET || 'dev-only-secret-not-for-production'
const SESSION_COOKIE = 'accounterp_session'
const TENANT_COOKIE = 'accounterp_tenant'
const BUSINESS_COOKIE = 'accounterp_business'

// ============================================================
// PASSWORD HASHING
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// ============================================================
// JWT SESSION
// ============================================================

export interface SessionPayload {
  userId: string
  email: string
  name: string
  role: string // PLATFORM_ADMIN or USER
  tenantId?: string | null
  tenantRole?: string | null // TENANT_ADMIN, ACCOUNTANT, VIEWER
  businessId?: string | null
}

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' })
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload
  } catch {
    return null
  }
}

// ============================================================
// SESSION MANAGEMENT (cookie-based)
// ============================================================

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function setSession(payload: SessionPayload) {
  const cookieStore = await cookies()
  const token = createSessionToken(payload)
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  cookieStore.delete(TENANT_COOKIE)
  cookieStore.delete(BUSINESS_COOKIE)
}

// ============================================================
// CURRENT USER / TENANT / BUSINESS CONTEXT
// ============================================================

export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null
  return db.user.findUnique({ where: { id: session.userId } })
}

export async function getCurrentTenantId(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  // Platform admin can access any tenant
  if (session.role === 'PLATFORM_ADMIN') {
    const cookieStore = await cookies()
    return cookieStore.get(TENANT_COOKIE)?.value || session.tenantId || null
  }
  return session.tenantId || null
}

export async function getCurrentTenant() {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null
  return db.tenant.findUnique({ where: { id: tenantId }, include: { subscription: { include: { plan: true } } } })
}

export async function getCurrentBusinessId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(BUSINESS_COOKIE)?.value || null
}

export async function getCurrentBusiness() {
  const id = await getCurrentBusinessId()
  if (!id) return null
  const tenantId = await getCurrentTenantId()
  // Ensure business belongs to current tenant (tenant isolation)
  return db.business.findFirst({ where: { id, tenantId: tenantId || undefined } })
}

// ============================================================
// PERMISSION CHECKS
// ============================================================

export type Permission =
  | 'platform.admin'           // full platform access
  | 'tenant.admin'             // manage tenant settings, users, businesses
  | 'tenant.accounting'        // create/edit invoices, bills, payments, journal
  | 'tenant.view'              // read-only access
  | 'tenant.reports'           // view reports
  | 'tenant.settings'          // manage business settings

export async function hasPermission(permission: Permission): Promise<boolean> {
  const session = await getSession()
  if (!session) return false

  // Platform admin has all permissions
  if (session.role === 'PLATFORM_ADMIN') return true

  const tenantRole = session.tenantRole
  if (!tenantRole) return false

  switch (permission) {
    case 'platform.admin':
      return false
    case 'tenant.admin':
      return tenantRole === 'TENANT_ADMIN'
    case 'tenant.accounting':
      return tenantRole === 'TENANT_ADMIN' || tenantRole === 'ACCOUNTANT'
    case 'tenant.view':
      return true // all tenant members can view
    case 'tenant.reports':
      return true
    case 'tenant.settings':
      return tenantRole === 'TENANT_ADMIN'
    default:
      return false
  }
}

export async function requirePermission(permission: Permission): Promise<void> {
  const has = await hasPermission(permission)
  if (!has) {
    throw new Error('Unauthorized: insufficient permissions')
  }
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized: not authenticated')
  }
  return session
}

// ============================================================
// TENANT ISOLATION HELPERS
// ============================================================

// Ensure a business belongs to the current tenant
export async function verifyBusinessTenant(businessId: string): Promise<boolean> {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return false
  const business = await db.business.findFirst({ where: { id: businessId, tenantId } })
  return !!business
}

// Get tenant-scoped where clause for Prisma queries
export async function tenantWhere(): Promise<{ tenantId: string | null }> {
  const tenantId = await getCurrentTenantId()
  return { tenantId }
}

// Get business-scoped where clause (verifies business belongs to tenant)
export async function businessWhere(): Promise<{ id: string; tenantId: string } | { id: string }> {
  const businessId = await getCurrentBusinessId()
  const tenantId = await getCurrentTenantId()
  if (!businessId) throw new Error('No business selected')
  // Platform admin can access any business
  if (!tenantId) return { id: businessId }
  return { id: businessId, tenantId }
}

// ============================================================
// ENSURE DEFAULTS (auto-create on first load)
// ============================================================

export async function ensureTenantContext(): Promise<string> {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  // Platform admin: use cookie tenant or first tenant
  if (session.role === 'PLATFORM_ADMIN') {
    const cookieStore = await cookies()
    const cookieTenant = cookieStore.get(TENANT_COOKIE)?.value
    if (cookieTenant) {
      const t = await db.tenant.findUnique({ where: { id: cookieTenant } })
      if (t) return t.id
    }
    const first = await db.tenant.findFirst({ orderBy: { createdAt: 'asc' } })
    if (first) {
      cookieStore.set(TENANT_COOKIE, first.id, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
      return first.id
    }
    throw new Error('No tenants found')
  }

  if (session.tenantId) return session.tenantId
  throw new Error('No tenant context')
}

// Custom error class for auth errors — allows API routes to distinguish auth errors
export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function ensureBusinessId(): Promise<string> {
  const session = await getSession()
  if (!session) {
    throw new AuthError('Not authenticated')
  }

  const businessId = await getCurrentBusinessId()
  if (businessId) {
    // Verify it belongs to current tenant
    const tenantId = await getCurrentTenantId()
    if (tenantId) {
      const biz = await db.business.findFirst({ where: { id: businessId, tenantId } })
      if (biz) return biz.id
    }
  }

  // Find or create first business for tenant
  const tenantId = await ensureTenantContext()
  let business = await db.business.findFirst({ where: { tenantId }, orderBy: { createdAt: 'asc' } })

  if (!business) {
    business = await db.business.create({
      data: { tenantId, name: 'My Company', baseCurrency: 'AED', vatRegistered: true, vatRate: 5.0 },
    })
    // Seed chart of accounts
    const { seedChartOfAccounts, seedTaxRates, seedCurrencies, seedDefaultTemplates } = await import('./seed')
    await seedChartOfAccounts(business.id)
    await seedTaxRates(business.id)
    await seedCurrencies(business.id)
    await seedDefaultTemplates(business.id)
  }

  const cookieStore = await cookies()
  cookieStore.set(BUSINESS_COOKIE, business.id, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
  return business.id
}
