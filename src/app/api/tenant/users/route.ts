import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, getCurrentTenantId, hasPermission, hashPassword } from '@/lib/auth'
import { z } from 'zod'

// GET /api/tenant/users — list users in current tenant
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const memberships = await db.userTenant.findMany({
    where: { tenantId },
    include: { user: true },
    orderBy: { invitedAt: 'desc' },
  })

  return NextResponse.json(memberships.map(m => ({
    id: m.id,
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    isActive: m.isActive,
    lastLoginAt: m.user.lastLoginAt,
    joinedAt: m.joinedAt,
  })))
}

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['TENANT_ADMIN', 'ACCOUNTANT', 'VIEWER']),
  password: z.string().min(6).optional(),
})

// POST — invite/add a user to the tenant
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json({ error: 'Tenant admin access required' }, { status: 403 })
  }

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const body = await req.json()
  const { name, email, role, password } = inviteSchema.parse(body)

  // Check plan limits
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: { include: { plan: true } } },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const maxUsers = tenant.subscription?.plan?.maxUsers || 2
  const currentUsers = await db.userTenant.count({ where: { tenantId, isActive: true } })
  if (currentUsers >= maxUsers) {
    return NextResponse.json({ error: `User limit reached (${maxUsers}). Upgrade your plan to add more users.` }, { status: 400 })
  }

  // Find or create user
  let user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user) {
    if (!password) {
      return NextResponse.json({ error: 'Password required for new user' }, { status: 400 })
    }
    const passwordHash = await hashPassword(password)
    user = await db.user.create({
      data: { email: email.toLowerCase(), name, passwordHash, role: 'USER' },
    })
  } else {
    // Update name if provided
    if (user.name !== name) {
      user = await db.user.update({ where: { id: user.id }, data: { name } })
    }
  }

  // Check if already a member
  const existing = await db.userTenant.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId } },
  })
  if (existing) {
    return NextResponse.json({ error: 'User is already a member of this tenant' }, { status: 400 })
  }

  const membership = await db.userTenant.create({
    data: { userId: user.id, tenantId, role, joinedAt: new Date() },
  })

  return NextResponse.json({
    id: membership.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    joinedAt: membership.joinedAt,
  })
}

// PUT — update user role
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json({ error: 'Tenant admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const membershipId = searchParams.get('id')
  if (!membershipId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await req.json()
  const membership = await db.userTenant.update({
    where: { id: membershipId },
    data: {
      role: body.role,
      isActive: body.isActive,
    },
  })

  return NextResponse.json(membership)
}

// DELETE — remove user from tenant
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json({ error: 'Tenant admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const membershipId = searchParams.get('id')
  if (!membershipId) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Prevent removing yourself
  const membership = await db.userTenant.findUnique({ where: { id: membershipId } })
  if (membership?.userId === session.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  await db.userTenant.delete({ where: { id: membershipId } })
  return NextResponse.json({ ok: true })
}
