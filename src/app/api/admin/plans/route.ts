import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

// GET /api/admin/plans
export async function GET() {
  const plans = await db.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })
  return NextResponse.json(plans.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    maxBusinesses: p.maxBusinesses,
    maxUsers: p.maxUsers,
    maxInvoicesPerMonth: p.maxInvoicesPerMonth,
    priceMonthly: Number(p.priceMonthly),
    priceYearly: Number(p.priceYearly),
    features: p.features ? JSON.parse(p.features) : {},
    isPublic: p.isPublic,
  })))
}

// POST — create plan
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const plan = await db.plan.create({
    data: {
      name: body.name,
      description: body.description || null,
      maxBusinesses: body.maxBusinesses || 1,
      maxUsers: body.maxUsers || 2,
      maxInvoicesPerMonth: body.maxInvoicesPerMonth || 100,
      priceMonthly: body.priceMonthly || 0,
      priceYearly: body.priceYearly || 0,
      features: body.features ? JSON.stringify(body.features) : '{}',
      isPublic: body.isPublic !== false,
    },
  })
  return NextResponse.json(plan)
}

// PUT
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
  const plan = await db.plan.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description || null,
      maxBusinesses: body.maxBusinesses,
      maxUsers: body.maxUsers,
      maxInvoicesPerMonth: body.maxInvoicesPerMonth,
      priceMonthly: body.priceMonthly,
      priceYearly: body.priceYearly,
      features: body.features ? JSON.stringify(body.features) : '{}',
      isPublic: body.isPublic,
    },
  })
  return NextResponse.json(plan)
}
