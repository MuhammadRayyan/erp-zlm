import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { money, toNumber } from '@/lib/decimal'

// GET /api/statements?partyId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns the party statement: opening balance, running balance, closing balance.
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
  const partyId = searchParams.get('partyId')
  if (!partyId) return NextResponse.json({ error: 'partyId is required' }, { status: 400 })

  const party = await db.party.findFirst({ where: { id: partyId, businessId } })
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 })

  const fromDate = searchParams.get('from') ? new Date(searchParams.get('from')!) : null
  const toDate = searchParams.get('to') ? new Date(searchParams.get('to')!) : null
  if (toDate) toDate.setHours(23, 59, 59, 999)

  // Opening balance:
  //  - party.openingBalance (DEBIT = positive owed to us; CREDIT = we owe them)
  //  - plus all transactions dated BEFORE the from date (or all if no from date → opening = 0)
  let opening = money(party.openingBalance)
  if (party.openingBalanceType === 'CREDIT') opening = opening.neg()

  if (fromDate) {
    // Sum of invoices/bills/payments/credit-notes before fromDate
    const [priorInvoices, priorBills, priorPayments, priorCreditNotes] = await Promise.all([
      db.salesInvoice.findMany({
        where: {
          businessId,
          partyId,
          date: { lt: fromDate },
          status: { not: 'DRAFT' },
        },
        select: { total: true, amountPaid: true },
      }),
      db.purchaseBill.findMany({
        where: {
          businessId,
          partyId,
          date: { lt: fromDate },
          status: { not: 'DRAFT' },
        },
        select: { total: true, amountPaid: true },
      }),
      db.payment.findMany({
        where: { businessId, partyId, date: { lt: fromDate } },
        select: { type: true, amount: true },
      }),
      db.creditNote.findMany({
        where: {
          businessId,
          partyId,
          date: { lt: fromDate },
          status: { not: 'DRAFT' },
        },
        select: { total: true },
      }),
    ])

    // For a customer (CUSTOMER/BOTH): receivables increase balance, receipts reduce it
    // For a supplier (SUPPLIER/BOTH): payables increase balance (we owe), payments reduce it
    const isCustomer = party.type === 'CUSTOMER' || party.type === 'BOTH'
    const isSupplier = party.type === 'SUPPLIER' || party.type === 'BOTH'

    let movement = money(0)
    if (isCustomer) {
      movement = movement
        .plus(priorInvoices.reduce((s, i) => s.plus(money(i.total).minus(money(i.amountPaid))), money(0)))
        .minus(priorPayments.filter(p => p.type === 'RECEIPT').reduce((s, p) => s.plus(money(p.amount)), money(0)))
        .minus(priorCreditNotes.reduce((s, c) => s.plus(money(c.total)), money(0)))
    }
    if (isSupplier) {
      movement = movement
        .plus(priorBills.reduce((s, b) => s.plus(money(b.total).minus(money(b.amountPaid))), money(0)))
        .minus(priorPayments.filter(p => p.type === 'PAYMENT').reduce((s, p) => s.plus(money(p.amount)), money(0)))
    }
    opening = opening.plus(movement)
  }

  // Fetch transactions in the [from, to] range
  const invoiceWhere: { businessId: string; partyId: string; status?: { not: string }; date?: { gte?: Date; lte?: Date } } = {
    businessId,
    partyId,
    status: { not: 'DRAFT' },
  }
  if (fromDate || toDate) {
    invoiceWhere.date = {}
    if (fromDate) invoiceWhere.date.gte = fromDate
    if (toDate) invoiceWhere.date.lte = toDate
  }

  const [invoices, bills, payments, creditNotes] = await Promise.all([
    db.salesInvoice.findMany({
      where: invoiceWhere,
      select: { id: true, number: true, date: true, total: true, amountPaid: true, status: true },
    }),
    db.purchaseBill.findMany({
      where: invoiceWhere,
      select: { id: true, number: true, date: true, total: true, amountPaid: true, status: true },
    }),
    db.payment.findMany({
      where: { businessId, partyId, ...(invoiceWhere.date ? { date: invoiceWhere.date } : {}) },
      select: { id: true, number: true, date: true, type: true, amount: true, method: true, reference: true },
    }),
    db.creditNote.findMany({
      where: invoiceWhere,
      select: { id: true, number: true, date: true, total: true, reason: true, status: true },
    }),
  ])

  const isCustomer = party.type === 'CUSTOMER' || party.type === 'BOTH'
  const isSupplier = party.type === 'SUPPLIER' || party.type === 'BOTH'

  type Line = {
    date: Date
    description: string
    reference?: string | null
    debit: number // increases receivable/payable balance
    credit: number // reduces the balance
    type: string
    id: string
    number: string
  }
  const lines: Line[] = []

  if (isCustomer) {
    for (const inv of invoices) {
      lines.push({
        id: inv.id,
        number: inv.number,
        date: inv.date,
        description: `Invoice ${inv.number}`,
        reference: null,
        debit: toNumber(inv.total),
        credit: 0,
        type: 'INVOICE',
      })
    }
    for (const cn of creditNotes) {
      lines.push({
        id: cn.id,
        number: cn.number,
        date: cn.date,
        description: `Credit Note ${cn.number}${cn.reason ? ` — ${cn.reason}` : ''}`,
        reference: null,
        debit: 0,
        credit: toNumber(cn.total),
        type: 'CREDIT_NOTE',
      })
    }
    for (const pmt of payments.filter(p => p.type === 'RECEIPT')) {
      lines.push({
        id: pmt.id,
        number: pmt.number,
        date: pmt.date,
        description: `Receipt ${pmt.number}${pmt.reference ? ` — ${pmt.reference}` : ''}`,
        reference: pmt.reference,
        debit: 0,
        credit: toNumber(pmt.amount),
        type: 'RECEIPT',
      })
    }
  }
  if (isSupplier) {
    for (const b of bills) {
      lines.push({
        id: b.id,
        number: b.number,
        date: b.date,
        description: `Bill ${b.number}`,
        reference: null,
        debit: toNumber(b.total),
        credit: 0,
        type: 'BILL',
      })
    }
    for (const pmt of payments.filter(p => p.type === 'PAYMENT')) {
      lines.push({
        id: pmt.id,
        number: pmt.number,
        date: pmt.date,
        description: `Payment ${pmt.number}${pmt.reference ? ` — ${pmt.reference}` : ''}`,
        reference: pmt.reference,
        debit: 0,
        credit: toNumber(pmt.amount),
        type: 'PAYMENT',
      })
    }
  }

  // Sort chronologically and compute running balance
  lines.sort((a, b) => a.date.getTime() - b.date.getTime())

  let running = opening
  const statements = lines.map(l => {
    running = running.plus(money(l.debit)).minus(money(l.credit))
    return { ...l, date: l.date.toISOString(), balance: toNumber(running) }
  })

  const totalDebit = lines.reduce((s, l) => s.plus(money(l.debit)), money(0))
  const totalCredit = lines.reduce((s, l) => s.plus(money(l.credit)), money(0))
  const closing = opening.plus(totalDebit).minus(totalCredit)

  return NextResponse.json({
    party: {
      id: party.id,
      name: party.name,
      type: party.type,
      trn: party.trn,
      email: party.email,
      phone: party.phone,
      billingAddress1: party.billingAddress1,
      billingCity: party.billingCity,
      billingState: party.billingState,
      billingCountry: party.billingCountry,
    },
    period: {
      from: fromDate ? fromDate.toISOString() : null,
      to: toDate ? toDate.toISOString() : null,
    },
    openingBalance: toNumber(opening),
    closingBalance: toNumber(closing),
    totals: {
      debit: toNumber(totalDebit),
      credit: toNumber(totalCredit),
      netMovement: toNumber(totalDebit.minus(totalCredit)),
    },
    lines: statements,
  })
}
