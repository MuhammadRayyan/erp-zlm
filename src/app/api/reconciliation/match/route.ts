import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getSession, AuthError } from '@/lib/auth'
import { toNumber, money } from '@/lib/decimal'
import { logActivity } from '@/lib/activity-logger'

// POST /api/reconciliation/match
// Body: { reconciliationId, bankTransactionId, paymentId }
// Marks the bank transaction as reconciled, links it to the payment, marks the
// payment as reconciled too.
export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const { reconciliationId, bankTransactionId, paymentId } = body as {
    reconciliationId?: string
    bankTransactionId?: string
    paymentId?: string
  }

  if (!reconciliationId || !bankTransactionId) {
    return NextResponse.json(
      { error: 'reconciliationId and bankTransactionId are required' },
      { status: 400 },
    )
  }

  const rec = await db.reconciliation.findFirst({ where: { id: reconciliationId, businessId } })
  if (!rec) return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 })
  if (rec.status !== 'IN_PROGRESS') {
    return NextResponse.json(
      { error: `Reconciliation is ${rec.status} — cannot match transactions` },
      { status: 400 },
    )
  }

  const bankTx = await db.bankTransaction.findUnique({
    where: { id: bankTransactionId },
    include: { bankAccount: { select: { businessId: true } } },
  })
  if (!bankTx) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
  if (bankTx.bankAccount.businessId !== businessId) {
    return NextResponse.json({ error: 'Bank transaction does not belong to current business' }, { status: 403 })
  }
  if (bankTx.bankAccountId !== rec.bankAccountId) {
    return NextResponse.json(
      { error: 'Bank transaction does not belong to the reconciliation account' },
      { status: 400 },
    )
  }
  if (bankTx.isReconciled) {
    return NextResponse.json(
      { error: 'Bank transaction is already reconciled' },
      { status: 400 },
    )
  }

  // Verify payment if provided
  let payment: { id: string; amount: unknown; businessId: string } | null = null
  if (paymentId) {
    payment = await db.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, amount: true, businessId: true },
    })
    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (payment.businessId !== businessId) {
      return NextResponse.json(
        { error: 'Payment does not belong to current business' },
        { status: 403 },
      )
    }
    if (await db.payment.findFirst({ where: { id: paymentId, isReconciled: true } })) {
      return NextResponse.json({ error: 'Payment is already reconciled' }, { status: 400 })
    }
  }

  const now = new Date()
  await db.bankTransaction.update({
    where: { id: bankTransactionId },
    data: {
      isReconciled: true,
      reconciledAt: now,
      paymentId: paymentId || null,
      reconciliationId: rec.id,
    },
  })

  if (payment) {
    await db.payment.update({
      where: { id: payment.id },
      data: { isReconciled: true, reconciledAt: now },
    })
  }

  void logActivity(
    businessId,
    session.userId,
    'RECONCILIATION',
    rec.id,
    'MATCHED',
    `Bank transaction matched${payment ? ' to payment' : ''}`,
    {
      bankTransactionId,
      paymentId: paymentId || null,
      amount: toNumber(money(bankTx.amount)),
    },
  )

  return NextResponse.json({ ok: true, bankTransactionId, paymentId: paymentId || null })
}

// DELETE /api/reconciliation/match?bankTransactionId=xxx
// Unmatches a previously matched bank transaction. Clears the reconciled flag on the
// bank transaction AND on the linked payment (if any), and detaches it from the
// reconciliation.
export async function DELETE(req: NextRequest) {
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

  const { searchParams } = new URL(req.url)
  const bankTransactionId = searchParams.get('bankTransactionId')
  if (!bankTransactionId) {
    return NextResponse.json({ error: 'bankTransactionId is required' }, { status: 400 })
  }

  const bankTx = await db.bankTransaction.findUnique({
    where: { id: bankTransactionId },
    include: { bankAccount: { select: { businessId: true } } },
  })
  if (!bankTx) return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 })
  if (bankTx.bankAccount.businessId !== businessId) {
    return NextResponse.json(
      { error: 'Bank transaction does not belong to current business' },
      { status: 403 },
    )
  }
  if (!bankTx.isReconciled) {
    return NextResponse.json(
      { error: 'Bank transaction is not reconciled' },
      { status: 400 },
    )
  }

  // If a reconciliation is COMPLETED, do not allow unmatching
  if (bankTx.reconciliationId) {
    const rec = await db.reconciliation.findUnique({
      where: { id: bankTx.reconciliationId },
      select: { status: true, businessId: true },
    })
    if (rec && rec.businessId === businessId && rec.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot unmatch a transaction in a completed reconciliation' },
        { status: 400 },
      )
    }
  }

  // Clear the linked payment's reconciled flag (if any)
  if (bankTx.paymentId) {
    await db.payment.update({
      where: { id: bankTx.paymentId },
      data: { isReconciled: false, reconciledAt: null },
    })
  }

  await db.bankTransaction.update({
    where: { id: bankTransactionId },
    data: {
      isReconciled: false,
      reconciledAt: null,
      paymentId: null,
      reconciliationId: null,
    },
  })

  void logActivity(
    businessId,
    session.userId,
    'RECONCILIATION',
    bankTx.reconciliationId || '',
    'UNMATCHED',
    `Bank transaction unmatched`,
    {
      bankTransactionId,
      paymentId: bankTx.paymentId || null,
    },
  )

  return NextResponse.json({ ok: true, bankTransactionId })
}
