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

// POST removed to prevent tenant admins from upgrading their own plan.
// Contact platform admin to upgrade.
