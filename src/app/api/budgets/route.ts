import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Budgets are stored in AppSetting as a JSON array — there's no dedicated
// Budget model in the Prisma schema.
export interface Budget {
  id: string
  name: string
  fiscalYear?: string
  period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
  startDate: string
  endDate: string
  accountId?: string
  entries: Array<{
    id: string
    period: string // e.g. "2024-01" or "2024-Q1" or "2024"
    amount: number
    actual?: number
  }>
  totalAmount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const NAMESPACE = 'budgets'

// GET /api/budgets
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
  const items = (await getBusinessSetting<Budget[]>(businessId, NAMESPACE)) || []
  return NextResponse.json(items)
}

// POST /api/budgets — create a new budget
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
  if (!body.name || !body.period || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'name, period, startDate, and endDate are required' },
      { status: 400 }
    )
  }
  if (!Array.isArray(body.entries)) {
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 })
  }

  const items = (await getBusinessSetting<Budget[]>(businessId, NAMESPACE)) || []
  const now = new Date().toISOString()
  const totalAmount = (body.entries as Array<{ amount?: number }>).reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  )
  const newBudget: Budget = {
    id: `bud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: body.name,
    fiscalYear: body.fiscalYear,
    period: body.period,
    startDate: new Date(body.startDate).toISOString(),
    endDate: new Date(body.endDate).toISOString(),
    accountId: body.accountId,
    entries: (body.entries as Array<{ period: string; amount: number }>).map((e, i) => ({
      id: `be_${Date.now()}_${i}`,
      period: e.period,
      amount: Number(e.amount) || 0,
    })),
    totalAmount,
    isActive: body.isActive !== false,
    createdAt: now,
    updatedAt: now,
  }
  items.push(newBudget)
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
          action: 'BUDGET_CREATED',
          entityType: 'BUDGET',
          entityId: newBudget.id,
          description: `Created budget "${newBudget.name}" (${newBudget.totalAmount})`,
        },
      })
      .catch(() => {})
  }

  return NextResponse.json(newBudget, { status: 201 })
}

// PUT /api/budgets?id=xxx
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
  const items = (await getBusinessSetting<Budget[]>(businessId, NAMESPACE)) || []
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const totalAmount = Array.isArray(body.entries)
    ? (body.entries as Array<{ amount?: number }>).reduce(
        (s, e) => s + Number(e.amount || 0),
        0
      )
    : items[idx].totalAmount

  const updated: Budget = {
    ...items[idx],
    ...body,
    id,
    totalAmount,
    entries: Array.isArray(body.entries)
      ? (body.entries as Array<{ period: string; amount: number; id?: string }>).map((e, i) => ({
          id: e.id || `be_${Date.now()}_${i}`,
          period: e.period,
          amount: Number(e.amount) || 0,
        }))
      : items[idx].entries,
    updatedAt: new Date().toISOString(),
  }
  items[idx] = updated
  await setBusinessSetting(businessId, NAMESPACE, items)
  return NextResponse.json(updated)
}

// DELETE /api/budgets?id=xxx
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

  const items = (await getBusinessSetting<Budget[]>(businessId, NAMESPACE)) || []
  const remaining = items.filter(i => i.id !== id)
  await setBusinessSetting(businessId, NAMESPACE, remaining)
  return NextResponse.json({ ok: true })
}
