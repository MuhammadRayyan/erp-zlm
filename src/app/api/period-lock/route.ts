import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// A locked period prevents users from creating/editing transactions in a
// given date range. Stored in AppSetting as a JSON array.
export interface PeriodLock {
  id: string
  startDate: string // ISO date
  endDate: string // ISO date
  reason?: string
  lockedAt: string
  lockedBy?: string
}

const NAMESPACE = 'locked_periods'

// GET /api/period-lock — list all locked periods for the current business
export async function GET() {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const periods = (await getBusinessSetting<PeriodLock[]>(businessId, NAMESPACE)) || []
  return NextResponse.json(periods)
}

// POST /api/period-lock — lock a period
// Body: { startDate, endDate, reason? }
export async function POST(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const session = await getSession()
  const tenantId = await getCurrentTenantId()
  const body = await req.json()

  if (!body.startDate || !body.endDate) {
    return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
  }

  const start = new Date(body.startDate)
  const end = new Date(body.endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
  }
  if (start > end) {
    return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 })
  }

  const periods = (await getBusinessSetting<PeriodLock[]>(businessId, NAMESPACE)) || []
  const newPeriod: PeriodLock = {
    id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    reason: body.reason || undefined,
    lockedAt: new Date().toISOString(),
    lockedBy: session?.userId,
  }
  periods.push(newPeriod)
  await setBusinessSetting(businessId, NAMESPACE, periods)

  // Audit log
  if (tenantId && session?.userId) {
    await db.auditLog
      .create({
        data: {
          businessId,
          tenantId,
          userId: session.userId,
          action: 'PERIOD_LOCKED',
          entityType: 'PERIOD_LOCK',
          entityId: newPeriod.id,
          description: `Locked period ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
        },
      })
      .catch(() => {})
  }

  return NextResponse.json(newPeriod, { status: 201 })
}

// DELETE /api/period-lock?id=xxx — unlock a period
export async function DELETE(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const periods = (await getBusinessSetting<PeriodLock[]>(businessId, NAMESPACE)) || []
  const remaining = periods.filter(p => p.id !== id)
  if (remaining.length === periods.length) {
    return NextResponse.json({ error: 'Period lock not found' }, { status: 404 })
  }
  await setBusinessSetting(businessId, NAMESPACE, remaining)

  const session = await getSession()
  const tenantId = await getCurrentTenantId()
  if (tenantId && session?.userId) {
    await db.auditLog
      .create({
        data: {
          businessId,
          tenantId,
          userId: session.userId,
          action: 'PERIOD_UNLOCKED',
          entityType: 'PERIOD_LOCK',
          entityId: id,
          description: `Unlocked period ${id}`,
        },
      })
      .catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
