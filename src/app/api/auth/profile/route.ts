import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, setSession } from '@/lib/auth'

// GET /api/auth/profile — current user profile with tenant memberships and stats
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      tenantMemberships: {
        include: {
          tenant: {
            include: {
              subscription: { include: { plan: true } },
              _count: { select: { businesses: true } },
            },
          },
        },
        where: { isActive: true },
        orderBy: { joinedAt: 'asc' },
      },
      _count: {
        select: {
          invoices: true,
          bills: true,
          payments: true,
          journalEntries: true,
          auditLogs: true,
          activities: true,
        },
      },
    },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    tenants: user.tenantMemberships.map(m => ({
      tenantId: m.tenant.id,
      tenantName: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role,
      status: m.tenant.status,
      plan: m.tenant.subscription?.plan?.name || 'No plan',
      planId: m.tenant.subscription?.planId || null,
      subscriptionStatus: m.tenant.subscription?.status || 'NONE',
      businessCount: m.tenant._count.businesses,
      joinedAt: m.joinedAt,
    })),
    stats: {
      invoicesCreated: user._count.invoices,
      billsCreated: user._count.bills,
      paymentsCreated: user._count.payments,
      journalEntries: user._count.journalEntries,
      auditLogs: user._count.auditLogs,
      activities: user._count.activities,
    },
    currentTenantId: session.tenantId,
    currentTenantRole: session.tenantRole,
  })
}

// PUT /api/auth/profile — update name and email
// Body: { name?, email? }
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json()
  const data: { name?: string; email?: string } = {}
  if (typeof body.name === 'string' && body.name.trim().length >= 2) {
    data.name = body.name.trim()
  }
  if (typeof body.email === 'string' && body.email.includes('@')) {
    const lower = body.email.trim().toLowerCase()
    // Ensure email is not already taken by someone else
    const existing = await db.user.findUnique({ where: { email: lower } })
    if (existing && existing.id !== session.userId) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }
    data.email = lower
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const updated = await db.user.update({
    where: { id: session.userId },
    data,
  })

  // Re-issue the session token with updated values
  await setSession({
    userId: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    tenantId: session.tenantId,
    tenantRole: session.tenantRole,
    businessId: session.businessId,
  })

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
  })
}
