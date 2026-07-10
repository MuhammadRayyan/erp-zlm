import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import { Decimal, money, toNumber } from '@/lib/decimal'

// GET /api/admin/stats — platform-wide statistics
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [
    tenantCount,
    activeTenants,
    trialTenants,
    userCount,
    businessCount,
    invoiceCount,
    monthInvoices,
    plans,
    licenses,
  ] = await Promise.all([
    db.tenant.count(),
    db.tenant.count({ where: { status: 'ACTIVE' } }),
    db.tenant.count({ where: { status: 'TRIAL' } }),
    db.user.count(),
    db.business.count(),
    db.salesInvoice.count(),
    db.salesInvoice.findMany({ where: { date: { gte: startOfMonth }, status: { not: 'DRAFT' } }, select: { total: true } }),
    db.plan.findMany({ include: { subscriptions: true } }),
    db.license.findMany({ where: { status: 'ACTIVE' } }),
  ])

  const monthRevenue = monthInvoices.reduce((s, inv) => s + toNumber(money(inv.total)), 0)

  // Plan distribution
  const planDistribution = plans.map(p => ({
    plan: p.name,
    subscribers: p.subscriptions.length,
    monthlyValue: toNumber(money(p.priceMonthly).mul(p.subscriptions.length)),
  }))

  return NextResponse.json({
    tenants: {
      total: tenantCount,
      active: activeTenants,
      trial: trialTenants,
    },
    users: userCount,
    businesses: businessCount,
    invoices: {
      total: invoiceCount,
      thisMonth: monthInvoices.length,
      thisMonthValue: monthRevenue,
    },
    licenses: {
      active: licenses.length,
    },
    plans: planDistribution,
    monthlyRecurringRevenue: planDistribution.reduce((s, p) => s + p.monthlyValue, 0),
  })
}
