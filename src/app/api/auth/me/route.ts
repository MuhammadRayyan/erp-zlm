import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, getCurrentBusinessId } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ authenticated: false })
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      tenantMemberships: {
        include: { tenant: { include: { subscription: { include: { plan: true } } } } },
        where: { isActive: true },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ authenticated: false })
  }

  const currentBusinessId = await getCurrentBusinessId()
  const currentTenantId = session.tenantId

  // Get current business (verify tenant)
  let currentBusiness: { id: string; name: string } | null = null
  if (currentBusinessId && currentTenantId) {
    currentBusiness = await db.business.findFirst({
      where: { id: currentBusinessId, tenantId: currentTenantId },
    })
  }
  if (!currentBusiness && currentTenantId) {
    currentBusiness = await db.business.findFirst({
      where: { tenantId: currentTenantId },
      orderBy: { createdAt: 'asc' },
    })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    tenants: user.tenantMemberships.map(m => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role,
      status: m.tenant.status,
      plan: m.tenant.subscription?.plan?.name || 'No plan',
      planId: m.tenant.subscription?.planId || null,
    })),
    currentTenantId,
    currentTenantRole: session.tenantRole,
    currentBusinessId: currentBusiness?.id || null,
    currentBusinessName: currentBusiness?.name || null,
  })
}
