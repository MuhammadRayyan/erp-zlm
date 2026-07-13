import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Fiscal years. Stored in AppSetting as a JSON array (no dedicated model).
export interface FiscalYear {
  id: string
  name: string // e.g. "FY 2024"
  startDate: string
  endDate: string
  status: 'OPEN' | 'CLOSED' | 'LOCKED'
  closedAt?: string
  closedBy?: string
  isAdjustment?: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

const NAMESPACE = 'fiscal_years'

// GET /api/fiscal-year
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
  const items = (await getBusinessSetting<FiscalYear[]>(businessId, NAMESPACE)) || []
  return NextResponse.json(items.sort((a, b) => (a.startDate < b.startDate ? 1 : -1)))
}

// POST /api/fiscal-year — create or update
// Body (new): { name, startDate, endDate, isAdjustment?, notes? }
// Body (update): { id, name?, status?, notes? }
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

  const body = await req.json()
  const items = (await getBusinessSetting<FiscalYear[]>(businessId, NAMESPACE)) || []
  const now = new Date().toISOString()

  if (body.id) {
    const idx = items.findIndex(i => i.id === body.id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated: FiscalYear = {
      ...items[idx],
      ...body,
      id: items[idx].id,
      updatedAt: now,
      closedAt: body.status === 'CLOSED' ? items[idx].closedAt || now : items[idx].closedAt,
    }
    items[idx] = updated
    await setBusinessSetting(businessId, NAMESPACE, items)

    const session = await getSession()
    const tenantId = await getCurrentTenantId()
    if (tenantId && session?.userId) {
      await db.auditLog
        .create({
          data: {
            businessId,
            tenantId,
            userId: session.userId,
            action: 'FISCAL_YEAR_UPDATED',
            entityType: 'FISCAL_YEAR',
            entityId: updated.id,
            description: `Updated fiscal year ${updated.name} (${updated.status})`,
          },
        })
        .catch(() => {})
    }
    return NextResponse.json(updated)
  }

  if (!body.name || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'name, startDate, and endDate are required' },
      { status: 400 }
    )
  }
  const start = new Date(body.startDate)
  const end = new Date(body.endDate)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  const newFy: FiscalYear = {
    id: `fy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: body.name,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    status: body.status || 'OPEN',
    isAdjustment: body.isAdjustment || false,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
  }
  items.push(newFy)
  await setBusinessSetting(businessId, NAMESPACE, items)
  return NextResponse.json(newFy, { status: 201 })
}

// DELETE /api/fiscal-year?id=xxx
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

  const items = (await getBusinessSetting<FiscalYear[]>(businessId, NAMESPACE)) || []
  const remaining = items.filter(i => i.id !== id)
  await setBusinessSetting(businessId, NAMESPACE, remaining)
  return NextResponse.json({ ok: true })
}
