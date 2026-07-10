import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, setSession } from '@/lib/auth'

// Switch the current tenant context (for users with multiple tenants)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { tenantId } = await req.json()

  // Platform admin can switch to any tenant
  if (session.role === 'PLATFORM_ADMIN') {
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    await setSession({
      ...session,
      tenantId,
      tenantRole: 'TENANT_ADMIN', // platform admin acts as tenant admin
    })
    return NextResponse.json({ ok: true, tenantId })
  }

  // Regular user: verify they have access to this tenant
  const membership = await db.userTenant.findFirst({
    where: { userId: session.userId, tenantId, isActive: true },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Access denied to this tenant' }, { status: 403 })
  }

  await setSession({
    ...session,
    tenantId,
    tenantRole: membership.role,
  })

  return NextResponse.json({ ok: true, tenantId })
}
