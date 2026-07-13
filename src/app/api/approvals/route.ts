import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { toNumber } from '@/lib/decimal'

// GET /api/approvals?type=INVOICE|BILL|PAYMENT|CREDIT_NOTE|JOURNAL
// Returns all documents with status='PENDING' (or other approval-requiring states).
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
  const type = searchParams.get('type') // optional filter

  const items: Array<{
    id: string
    type: string
    number: string
    date: Date
    partyName: string
    amount: number
    status: string
    reference?: string | null
  }> = []

  if (!type || type === 'INVOICE') {
    const rows = await db.salesInvoice.findMany({
      where: { businessId, status: 'PENDING' },
      include: { party: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of rows) {
      items.push({
        id: r.id,
        type: 'INVOICE',
        number: r.number,
        date: r.date,
        partyName: r.party.name,
        amount: toNumber(r.total),
        status: r.status,
        reference: r.reference,
      })
    }
  }

  if (!type || type === 'BILL') {
    const rows = await db.purchaseBill.findMany({
      where: { businessId, status: 'PENDING' },
      include: { party: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of rows) {
      items.push({
        id: r.id,
        type: 'BILL',
        number: r.number,
        date: r.date,
        partyName: r.party.name,
        amount: toNumber(r.total),
        status: r.status,
        reference: r.reference,
      })
    }
  }

  if (!type || type === 'PAYMENT') {
    const rows = await db.payment.findMany({
      where: { businessId, status: 'PENDING' },
      include: { party: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of rows) {
      items.push({
        id: r.id,
        type: 'PAYMENT',
        number: r.number,
        date: r.date,
        partyName: r.party.name,
        amount: toNumber(r.amount),
        status: r.status,
        reference: r.reference,
      })
    }
  }

  if (!type || type === 'CREDIT_NOTE') {
    const rows = await db.creditNote.findMany({
      where: { businessId, status: 'PENDING' },
      include: { party: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    for (const r of rows) {
      items.push({
        id: r.id,
        type: 'CREDIT_NOTE',
        number: r.number,
        date: r.date,
        partyName: r.party.name,
        amount: toNumber(r.total),
        status: r.status,
        reference: r.reference,
      })
    }
  }

  return NextResponse.json({ items, count: items.length })
}

// POST /api/approvals — approve or reject a document
// Body: { id, type, action: 'APPROVE' | 'REJECT', reason? }
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
  const { id, type, action, reason } = body || {}
  if (!id || !type || !action) {
    return NextResponse.json(
      { error: 'id, type, and action are required' },
      { status: 400 }
    )
  }
  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json(
      { error: "action must be 'APPROVE' or 'REJECT'" },
      { status: 400 }
    )
  }

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const tenantId = await getCurrentTenantId()

  const newStatus = action === 'APPROVE' ? 'POSTED' : 'REJECTED'

  switch (type) {
    case 'INVOICE': {
      const inv = await db.salesInvoice.findFirst({ where: { id, businessId } })
      if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (inv.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Invoice is not pending approval (status: ${inv.status})` },
          { status: 400 }
        )
      }
      await db.salesInvoice.update({
        where: { id },
        data: {
          status: newStatus,
          postedAt: action === 'APPROVE' ? new Date() : null,
        },
      })
      break
    }
    case 'BILL': {
      const bill = await db.purchaseBill.findFirst({ where: { id, businessId } })
      if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (bill.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Bill is not pending approval (status: ${bill.status})` },
          { status: 400 }
        )
      }
      await db.purchaseBill.update({
        where: { id },
        data: {
          status: newStatus,
          postedAt: action === 'APPROVE' ? new Date() : null,
        },
      })
      break
    }
    case 'PAYMENT': {
      const pmt = await db.payment.findFirst({ where: { id, businessId } })
      if (!pmt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (pmt.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Payment is not pending approval (status: ${pmt.status})` },
          { status: 400 }
        )
      }
      await db.payment.update({
        where: { id },
        data: { status: action === 'APPROVE' ? 'POSTED' : 'CANCELLED' },
      })
      break
    }
    case 'CREDIT_NOTE': {
      const cn = await db.creditNote.findFirst({ where: { id, businessId } })
      if (!cn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      if (cn.status !== 'PENDING') {
        return NextResponse.json(
          { error: `Credit note is not pending approval (status: ${cn.status})` },
          { status: 400 }
        )
      }
      await db.creditNote.update({
        where: { id },
        data: {
          status: newStatus,
          postedAt: action === 'APPROVE' ? new Date() : null,
        },
      })
      break
    }
    default:
      return NextResponse.json({ error: `Unknown approval type: ${type}` }, { status: 400 })
  }

  // Audit log (best-effort)
  if (tenantId) {
    await db.auditLog
      .create({
        data: {
          businessId,
          tenantId,
          userId: session.userId,
          action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          entityType: type,
          entityId: id,
          description: `${action === 'APPROVE' ? 'Approved' : 'Rejected'} ${type} ${id}${
            reason ? ` — reason: ${reason}` : ''
          }`,
        },
      })
      .catch(() => {})
  }

  // Activity log (best-effort)
  await db.activityLog
    .create({
      data: {
        businessId,
        userId: session.userId,
        entityType: type,
        entityId: id,
        action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        message: `${action === 'APPROVE' ? 'Approved' : 'Rejected'} by ${session.name}${
          reason ? `: ${reason}` : ''
        }`,
        metadata: reason ? JSON.stringify({ reason }) : null,
      },
    })
    .catch(() => {})

  return NextResponse.json({ ok: true, id, type, action, newStatus })
}
