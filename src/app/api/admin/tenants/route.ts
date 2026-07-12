import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import { z } from 'zod'

// GET /api/admin/tenants — list all tenants (platform admin only)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const tenants = await db.tenant.findMany({
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { businesses: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(tenants.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    email: t.email,
    phone: t.phone,
    status: t.status,
    trialEndsAt: t.trialEndsAt,
    createdAt: t.createdAt,
    plan: t.subscription?.plan?.name || 'No plan',
    planId: t.subscription?.planId,
    subscriptionStatus: t.subscription?.status || 'NONE',
    businessCount: t._count.businesses,
    userCount: t._count.members,
  })))
}

// POST /api/admin/tenants — create tenant manually
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const body = await req.json()

  // Validate input with Zod
  const schema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Invalid email format'),
    planId: z.string().optional(),
    status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED']).optional(),
  })

  const parseResult = schema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { name, email, planId, status } = parseResult.data

  let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  let suffix = 0
  while (await db.tenant.findUnique({ where: { slug } })) {
    suffix++
    slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${suffix}`
  }

  const tenant = await db.tenant.create({
    data: {
      name,
      slug,
      email,
      status: status || 'ACTIVE',
    },
  })

  if (planId) {
    await db.subscription.create({
      data: {
        tenantId: tenant.id,
        planId,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
    })
  }

  return NextResponse.json(tenant)
}

// PUT /api/admin/tenants?id=xxx — update tenant
export async function PUT(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await req.json()

  // Validate input with Zod
  const updateSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED']).optional(),
    planId: z.string().optional(),
    subscriptionStatus: z.enum(['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED', 'PAUSED']).optional(),
  })

  const parseResult = updateSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { name, email, phone, status, planId, subscriptionStatus } = parseResult.data
  const tenant = await db.tenant.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone !== undefined && { phone }),
      ...(status && { status }),
    },
  })

  // Update subscription plan if provided
  if (planId) {
    const existing = await db.subscription.findUnique({ where: { tenantId: id } })
    if (existing) {
      await db.subscription.update({ where: { id: existing.id }, data: { planId, status: subscriptionStatus || 'ACTIVE' } })
    } else {
      await db.subscription.create({
        data: { tenantId: id, planId, status: subscriptionStatus || 'ACTIVE', billingCycle: 'MONTHLY', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
      })
    }
  }

  return NextResponse.json(tenant)
}

// DELETE /api/admin/tenants?id=xxx — suspend tenant (soft delete)
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await db.tenant.update({ where: { id }, data: { status: 'CANCELLED' } })
  return NextResponse.json({ ok: true })
}
