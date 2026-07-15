import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getSession, AuthError } from '@/lib/auth'
import { toNumber, money } from '@/lib/decimal'
import { logActivity, logAudit, getClientIp } from '@/lib/activity-logger'

// GET /api/reconciliation/[id] — get reconciliation details with matched/unmatched transactions
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { id } = await params
  const rec = await db.reconciliation.findFirst({
    where: { id, businessId },
    include: {
      bankAccount: { select: { id: true, name: true, currency: true, openingBalance: true, currentBalance: true } },
    },
  })
  if (!rec) return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 })

  // Bank transactions for this account up to and including statementDate that are not
  // yet reconciled OR are reconciled within this reconciliation session.
  const bankTxWhere = {
    bankAccountId: rec.bankAccountId,
    date: { lte: rec.statementDate },
    OR: [
      { isReconciled: false },
      { reconciliationId: rec.id },
    ],
  }
  const bankTransactions = await db.bankTransaction.findMany({
    where: bankTxWhere,
    orderBy: { date: 'asc' },
  })

  // System payments linked to this bank account (or unlinked) up to statementDate,
  // not yet reconciled OR linked via paymentId to a bank tx in this reconciliation.
  const payments = await db.payment.findMany({
    where: {
      businessId,
      date: { lte: rec.statementDate },
      OR: [
        { bankAccountId: rec.bankAccountId, isReconciled: false },
        {
          isReconciled: false,
          bankAccountId: null,
          method: { in: ['BANK_TRANSFER', 'CHEQUE', 'ONLINE'] },
        },
      ],
    },
    include: { party: { select: { name: true } } },
    orderBy: { date: 'asc' },
  })

  // Matched pairs in this reconciliation
  const matchedBankTx = bankTransactions.filter((t) => t.isReconciled && t.reconciliationId === rec.id)
  const matchedPaymentIds = new Set(
    matchedBankTx.map((t) => t.paymentId).filter(Boolean) as string[],
  )

  // Calculate cleared balance: opening + sum of matched bank transactions
  const opening = money(rec.bankAccount.openingBalance)
  const clearedDelta = matchedBankTx.reduce((s, t) => s.plus(money(t.amount)), money(0))
  const clearedBalance = opening.plus(clearedDelta)

  // Calculate statement-vs-system difference
  const statementBalance = money(rec.statementEndingBalance)
  const difference = statementBalance.minus(clearedBalance)

  // Compute the bank account's book (system) balance at statementDate — sum of all bank
  // transactions up to and including statementDate, plus opening balance.
  const allTxUpToDate = await db.bankTransaction.findMany({
    where: { bankAccountId: rec.bankAccountId, date: { lte: rec.statementDate } },
    select: { amount: true },
  })
  const bookBalance = opening.plus(
    allTxUpToDate.reduce((s, t) => s.plus(money(t.amount)), money(0)),
  )

  return NextResponse.json({
    id: rec.id,
    bankAccountId: rec.bankAccountId,
    bankAccountName: rec.bankAccount.name,
    currency: rec.bankAccount.currency,
    statementDate: rec.statementDate,
    statementEndingBalance: toNumber(rec.statementEndingBalance),
    status: rec.status,
    reconciledAt: rec.reconciledAt,
    reconciledBy: rec.reconciledBy,
    createdAt: rec.createdAt,
    openingBalance: toNumber(rec.bankAccount.openingBalance),
    currentBalance: toNumber(rec.bankAccount.currentBalance),
    clearedBalance: toNumber(clearedBalance),
    bookBalance: toNumber(bookBalance),
    difference: toNumber(difference),
    isBalanced: difference.isZero(),
    bankTransactions: bankTransactions.map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      reference: t.reference,
      amount: toNumber(t.amount),
      type: t.type,
      isReconciled: t.isReconciled,
      reconciliationId: t.reconciliationId,
      paymentId: t.paymentId,
    })),
    systemPayments: payments.map((p) => ({
      id: p.id,
      number: p.number,
      date: p.date,
      type: p.type,
      partyName: p.party.name,
      amount: toNumber(p.amount),
      method: p.method,
      reference: p.reference,
      description: p.description,
      isReconciled: p.isReconciled,
      isMatched: matchedPaymentIds.has(p.id),
    })),
  })
}

// PUT /api/reconciliation/[id] — update reconciliation (e.g., change ending balance)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { id } = await params
  const rec = await db.reconciliation.findFirst({ where: { id, businessId } })
  if (!rec) return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 })
  if (rec.status === 'COMPLETED') {
    return NextResponse.json({ error: 'Cannot edit a completed reconciliation' }, { status: 400 })
  }

  const body = await req.json()
  const data: { statementEndingBalance?: number; statementDate?: Date } = {}
  if (body.statementEndingBalance !== undefined) {
    data.statementEndingBalance = Number(body.statementEndingBalance)
  }
  if (body.statementDate) {
    data.statementDate = new Date(body.statementDate)
  }

  const updated = await db.reconciliation.update({ where: { id }, data })
  return NextResponse.json({
    id: updated.id,
    statementDate: updated.statementDate,
    statementEndingBalance: toNumber(updated.statementEndingBalance),
    status: updated.status,
  })
}

// POST /api/reconciliation/[id]?action=complete — finalize reconciliation
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action !== 'complete' && action !== 'cancel') {
    return NextResponse.json(
      { error: 'Unknown action. Use action=complete or action=cancel.' },
      { status: 400 },
    )
  }

  const rec = await db.reconciliation.findFirst({
    where: { id, businessId },
    include: {
      bankAccount: { select: { id: true, name: true, openingBalance: true } },
      bankTransactions: { select: { amount: true } },
    },
  })
  if (!rec) return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 })
  if (rec.status !== 'IN_PROGRESS') {
    return NextResponse.json(
      { error: `Reconciliation is already ${rec.status}` },
      { status: 400 },
    )
  }

  if (action === 'cancel') {
    // Unmatch all bank transactions linked to this reconciliation
    await db.bankTransaction.updateMany({
      where: { reconciliationId: rec.id },
      data: {
        isReconciled: false,
        reconciledAt: null,
        paymentId: null,
        reconciliationId: null,
      },
    })
    // Un-reconcile any payments that were matched via these bank transactions
    // (we set paymentId=null above so we can't easily find them now; rely on a separate
    // query before clearing). To keep it simple, mark all payments linked to this
    // bank account with isReconciled=true as unreconciled here.
    await db.payment.updateMany({
      where: { bankAccountId: rec.bankAccountId, isReconciled: true },
      data: { isReconciled: false, reconciledAt: null },
    })

    const cancelled = await db.reconciliation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    void logActivity(
      businessId,
      session.userId,
      'RECONCILIATION',
      id,
      'CANCELLED',
      `Reconciliation for ${rec.bankAccount.name} cancelled`,
      {},
    )
    return NextResponse.json({ id: cancelled.id, status: cancelled.status })
  }

  // action === 'complete' — verify the cleared balance matches the statement ending balance
  const opening = money(rec.bankAccount.openingBalance)
  const clearedDelta = rec.bankTransactions.reduce((s, t) => s.plus(money(t.amount)), money(0))
  const clearedBalance = opening.plus(clearedDelta)
  const difference = money(rec.statementEndingBalance).minus(clearedBalance)

  if (!difference.isZero()) {
    return NextResponse.json(
      {
        error: 'Reconciliation is not balanced',
        difference: toNumber(difference),
        clearedBalance: toNumber(clearedBalance),
        statementEndingBalance: toNumber(rec.statementEndingBalance),
      },
      { status: 400 },
    )
  }

  // Mark reconciliation as completed and stamp reconciledAt on all matched bank txs
  const now = new Date()
  await db.bankTransaction.updateMany({
    where: { reconciliationId: rec.id, isReconciled: true },
    data: { reconciledAt: now },
  })

  // Update bank account current balance to match statement ending balance
  await db.bankAccount.update({
    where: { id: rec.bankAccountId },
    data: { currentBalance: toNumber(rec.statementEndingBalance) },
  })

  const completed = await db.reconciliation.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      reconciledAt: now,
      reconciledBy: session.userId,
    },
  })

  // Activity + Audit logging (fire-and-forget)
  void logActivity(
    businessId,
    session.userId,
    'RECONCILIATION',
    id,
    'COMPLETED',
    `Reconciliation for ${rec.bankAccount.name} completed`,
    { matchedCount: rec.bankTransactions.length },
  )
  const tenantId = await getCurrentTenantIdSafe()
  if (tenantId) {
    void logAudit(
      businessId,
      tenantId,
      session.userId,
      'COMPLETED',
      'RECONCILIATION',
      id,
      `Reconciliation for ${rec.bankAccount.name} completed`,
      undefined,
      getClientIp(req),
    )
  }

  return NextResponse.json({
    id: completed.id,
    status: completed.status,
    reconciledAt: completed.reconciledAt,
    reconciledBy: completed.reconciledBy,
  })
}

// Helper — get tenant ID without throwing
async function getCurrentTenantIdSafe(): Promise<string | null> {
  try {
    const { getCurrentTenantId } = await import('@/lib/auth')
    return await getCurrentTenantId()
  } catch {
    return null
  }
}
