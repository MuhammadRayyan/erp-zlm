import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'
import { randomBytes } from 'crypto'

// Generate a license key
function generateLicenseKey(): string {
  const part = () => randomBytes(4).toString('hex').toUpperCase().slice(0, 8)
  return `ACC-${part()}-${part()}-${part()}`
}

// GET /api/admin/licenses
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const licenses = await db.license.findMany({
    include: { tenant: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(licenses.map(l => ({
    id: l.id,
    key: l.key,
    tenantId: l.tenantId,
    tenantName: null as string | null, // Will be populated below
    planName: l.planName,
    type: l.type,
    maxBusinesses: l.maxBusinesses,
    maxUsers: l.maxUsers,
    issuedTo: l.issuedTo,
    issuedAt: l.issuedAt,
    expiresAt: l.expiresAt,
    status: l.status,
    notes: l.notes,
  })))
}

// POST — create license
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const key = generateLicenseKey()

  const license = await db.license.create({
    data: {
      key,
      tenantId: body.tenantId || null,
      planName: body.planName || 'Professional',
      type: body.type || 'ANNUAL',
      maxBusinesses: body.maxBusinesses || 3,
      maxUsers: body.maxUsers || 10,
      issuedTo: body.issuedTo || null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      status: 'ACTIVE',
      notes: body.notes || null,
    },
  })

  // If tenantId provided, upgrade their subscription
  if (body.tenantId) {
    const plan = await db.plan.findFirst({ where: { name: body.planName } })
    if (plan) {
      const existing = await db.subscription.findUnique({ where: { tenantId: body.tenantId } })
      if (existing) {
        await db.subscription.update({ where: { id: existing.id }, data: { planId: plan.id, status: 'ACTIVE' } })
      } else {
        await db.subscription.create({
          data: { tenantId: body.tenantId, planId: plan.id, status: 'ACTIVE', billingCycle: 'YEARLY', currentPeriodStart: new Date(), currentPeriodEnd: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 365 * 86400000) },
        })
      }
    }
    await db.tenant.update({ where: { id: body.tenantId }, data: { status: 'ACTIVE' } })
  }

  return NextResponse.json(license)
}

// DELETE — revoke license
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json({ error: 'Platform admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await db.license.update({ where: { id }, data: { status: 'REVOKED' } })
  return NextResponse.json({ ok: true })
}
