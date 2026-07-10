import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenantId, hasPermission } from '@/lib/auth'

// GET /api/tenant/subscription — current tenant's subscription
export async function GET() {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { businesses: true, members: true } },
    },
  })

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
    },
    subscription: tenant.subscription ? {
      id: tenant.subscription.id,
      status: tenant.subscription.status,
      billingCycle: tenant.subscription.billingCycle,
      currentPeriodStart: tenant.subscription.currentPeriodStart,
      currentPeriodEnd: tenant.subscription.currentPeriodEnd,
      trialEndsAt: tenant.subscription.trialEndsAt,
    } : null,
    plan: tenant.subscription?.plan ? {
      id: tenant.subscription.plan.id,
      name: tenant.subscription.plan.name,
      description: tenant.subscription.plan.description,
      maxBusinesses: tenant.subscription.plan.maxBusinesses,
      maxUsers: tenant.subscription.plan.maxUsers,
      maxInvoicesPerMonth: tenant.subscription.plan.maxInvoicesPerMonth,
      priceMonthly: Number(tenant.subscription.plan.priceMonthly),
      priceYearly: Number(tenant.subscription.plan.priceYearly),
      features: tenant.subscription.plan.features ? JSON.parse(tenant.subscription.plan.features) : {},
    } : null,
    usage: {
      businesses: tenant._count.businesses,
      users: tenant._count.members,
    },
  })
}

// POST — change plan (tenant admin)
export async function POST(req: NextRequest) {
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json({ error: 'Tenant admin access required' }, { status: 403 })
  }

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const { planId } = await req.json()
  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  // Check if downgrade is allowed (current usage within new limits)
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { _count: { select: { businesses: true, members: true } } },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  if (tenant._count.businesses > plan.maxBusinesses) {
    return NextResponse.json({ error: `Cannot downgrade: you have ${tenant._count.businesses} businesses but this plan allows ${plan.maxBusinesses}` }, { status: 400 })
  }
  if (tenant._count.members > plan.maxUsers) {
    return NextResponse.json({ error: `Cannot downgrade: you have ${tenant._count.members} users but this plan allows ${plan.maxUsers}` }, { status: 400 })
  }

  const existing = await db.subscription.findUnique({ where: { tenantId } })
  if (existing) {
    await db.subscription.update({ where: { id: existing.id }, data: { planId, status: 'ACTIVE' } })
  } else {
    await db.subscription.create({
      data: { tenantId, planId, status: 'ACTIVE', billingCycle: 'MONTHLY', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
    })
  }

  await db.tenant.update({ where: { id: tenantId }, data: { status: 'ACTIVE' } })

  return NextResponse.json({ ok: true })
}
