import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Recurring transactions are templates that can be triggered manually or
// on a schedule. Stored in AppSetting as a JSON array (no dedicated model
// exists in the Prisma schema).
export interface RecurringTransaction {
  id: string
  name: string
  type: 'INVOICE' | 'BILL' | 'JOURNAL' | 'PAYMENT'
  schedule: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  startDate: string
  nextRunAt: string
  endDate?: string
  lastRunAt?: string
  partyId?: string
  amount?: number
  description?: string
  reference?: string
  lines?: Array<{ description: string; quantity: number; unitPrice: number; discount?: number; taxRateId?: string }>
  journalLines?: Array<{ accountId: string; debit: number; credit: number; description?: string }>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const NAMESPACE = 'recurring_transactions'

// GET /api/recurring
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
  const items = (await getBusinessSetting<RecurringTransaction[]>(businessId, NAMESPACE)) || []
  return NextResponse.json(items)
}

// POST /api/recurring — create a recurring transaction template
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
  if (!body.name || !body.type || !body.schedule || !body.startDate) {
    return NextResponse.json(
      { error: 'name, type, schedule, and startDate are required' },
      { status: 400 }
    )
  }

  const items = (await getBusinessSetting<RecurringTransaction[]>(businessId, NAMESPACE)) || []
  const now = new Date().toISOString()
  const start = new Date(body.startDate)
  const newItem: RecurringTransaction = {
    id: `rct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: body.name,
    type: body.type,
    schedule: body.schedule,
    startDate: start.toISOString(),
    nextRunAt: start.toISOString(),
    endDate: body.endDate || undefined,
    partyId: body.partyId || undefined,
    amount: body.amount,
    description: body.description || undefined,
    reference: body.reference || undefined,
    lines: body.lines,
    journalLines: body.journalLines,
    isActive: body.isActive !== false,
    createdAt: now,
    updatedAt: now,
  }
  items.push(newItem)
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
          action: 'RECURRING_CREATED',
          entityType: 'RECURRING_TRANSACTION',
          entityId: newItem.id,
          description: `Created recurring ${body.type}: ${body.name}`,
        },
      })
      .catch(() => {})
  }

  return NextResponse.json(newItem, { status: 201 })
}

// PUT /api/recurring?id=xxx — update a recurring transaction
export async function PUT(req: NextRequest) {
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

  const body = await req.json()
  const items = (await getBusinessSetting<RecurringTransaction[]>(businessId, NAMESPACE)) || []
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated: RecurringTransaction = {
    ...items[idx],
    ...body,
    id,
    updatedAt: new Date().toISOString(),
  }
  items[idx] = updated
  await setBusinessSetting(businessId, NAMESPACE, items)
  return NextResponse.json(updated)
}

// DELETE /api/recurring?id=xxx
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

  const items = (await getBusinessSetting<RecurringTransaction[]>(businessId, NAMESPACE)) || []
  const remaining = items.filter(i => i.id !== id)
  await setBusinessSetting(businessId, NAMESPACE, remaining)
  return NextResponse.json({ ok: true })
}
