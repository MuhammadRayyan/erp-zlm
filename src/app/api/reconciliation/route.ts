import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'
import { toNumber } from '@/lib/decimal'

// Bank reconciliation sessions. Stored in AppSetting (no dedicated model).
export interface ReconciliationSession {
  id: string
  bankAccountId: string
  startDate: string
  endDate: string
  startingBalance: number
  endingBalance: number
  clearedBalance: number
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  matchedTransactionIds: string[]
  notes?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

const NAMESPACE = 'reconciliation_sessions'

// GET /api/reconciliation?bankAccountId=xxx
export async function GET(req: NextRequest) {
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
  const bankAccountId = searchParams.get('bankAccountId')
  const sessionId = searchParams.get('id')

  const sessions = (await getBusinessSetting<ReconciliationSession[]>(businessId, NAMESPACE)) || []

  if (sessionId) {
    const s = sessions.find(x => x.id === sessionId)
    if (!s) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    // Attach the matched bank transactions for convenience
    const txns = await db.bankTransaction.findMany({
      where: { id: { in: s.matchedTransactionIds } },
    })
    return NextResponse.json({ ...s, transactions: txns })
  }

  let filtered = sessions
  if (bankAccountId) filtered = sessions.filter(s => s.bankAccountId === bankAccountId)

  return NextResponse.json(
    filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  )
}

// POST /api/reconciliation — create or update a reconciliation session
// Body for new session: { bankAccountId, startDate, endDate, startingBalance, endingBalance, notes? }
// Body for update: { id, matchedTransactionIds?, status?, notes?, clearedBalance? }
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
  const sessions = (await getBusinessSetting<ReconciliationSession[]>(businessId, NAMESPACE)) || []
  const now = new Date().toISOString()

  // Update existing
  if (body.id) {
    const idx = sessions.findIndex(s => s.id === body.id)
    if (idx === -1) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    const updated: ReconciliationSession = {
      ...sessions[idx],
      ...body,
      id: sessions[idx].id,
      updatedAt: now,
      completedAt:
        body.status === 'COMPLETED' ? now : sessions[idx].completedAt,
    }
    sessions[idx] = updated
    await setBusinessSetting(businessId, NAMESPACE, sessions)

    // If completed, mark the matched bank transactions as reconciled
    if (body.status === 'COMPLETED' && updated.matchedTransactionIds.length > 0) {
      await db.bankTransaction.updateMany({
        where: { id: { in: updated.matchedTransactionIds } },
        data: { isReconciled: true, reconciledAt: new Date() },
      })
    }

    const session = await getSession()
    const tenantId = await getCurrentTenantId()
    if (tenantId && session?.userId) {
      await db.auditLog
        .create({
          data: {
            businessId,
            tenantId,
            userId: session.userId,
            action: 'RECONCILIATION_UPDATED',
            entityType: 'RECONCILIATION',
            entityId: updated.id,
            description: `Updated reconciliation session (${updated.status})`,
          },
        })
        .catch(() => {})
    }
    return NextResponse.json(updated)
  }

  // Create new
  if (!body.bankAccountId || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'bankAccountId, startDate, and endDate are required' },
      { status: 400 }
    )
  }
  // Verify the bank account belongs to the current business
  const bankAccount = await db.bankAccount.findFirst({
    where: { id: body.bankAccountId, businessId },
  })
  if (!bankAccount) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 })

  const newSession: ReconciliationSession = {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    bankAccountId: body.bankAccountId,
    startDate: new Date(body.startDate).toISOString(),
    endDate: new Date(body.endDate).toISOString(),
    startingBalance: toNumber(body.startingBalance ?? bankAccount.openingBalance),
    endingBalance: toNumber(body.endingBalance ?? bankAccount.currentBalance),
    clearedBalance: toNumber(body.clearedBalance ?? 0),
    status: 'IN_PROGRESS',
    matchedTransactionIds: body.matchedTransactionIds || [],
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
  }
  sessions.push(newSession)
  await setBusinessSetting(businessId, NAMESPACE, sessions)
  return NextResponse.json(newSession, { status: 201 })
}

// DELETE /api/reconciliation?id=xxx
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

  const sessions = (await getBusinessSetting<ReconciliationSession[]>(businessId, NAMESPACE)) || []
  const remaining = sessions.filter(s => s.id !== id)
  await setBusinessSetting(businessId, NAMESPACE, remaining)
  return NextResponse.json({ ok: true })
}
