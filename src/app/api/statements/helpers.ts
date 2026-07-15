// Shared helpers for the statements API routes (route.ts and preview/route.ts).
// All money math goes through decimal.js — never floating point.
import { db } from '@/lib/db'
import { toNumber, money, Decimal } from '@/lib/decimal'

export function computeOpeningBalance(type: string, raw: Decimal | string | number): Decimal {
  // Opening balance: DEBIT means they owe us (positive); CREDIT means we owe them (negative).
  // We represent the balance as "amount the party owes us" — for suppliers this
  // will be negative when we owe them.
  const v = money(raw)
  return type === 'CREDIT' ? v.neg() : v
}

export interface TxRow {
  date: Date
  type: string
  reference: string
  description: string
  debit: Decimal | string | number
  credit: Decimal | string | number
  sortKey: string
}

export async function collectTransactions(
  businessId: string,
  partyId: string,
  isCustomer: boolean,
  isSupplier: boolean,
  startDate: Date | undefined,
  endDate: Date,
): Promise<TxRow[]> {
  const rows: TxRow[] = []
  const dateRange = startDate
    ? { gte: startDate, lte: endDate }
    : { lte: endDate }

  if (isCustomer) {
    // Sales invoices — debit (they owe us)
    const invoices = await db.salesInvoice.findMany({
      where: {
        businessId, partyId, date: dateRange,
        status: { in: ['POSTED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { number: true, date: true, total: true, reference: true },
    })
    for (const inv of invoices) {
      rows.push({
        date: inv.date,
        type: 'INVOICE',
        reference: inv.number,
        description: `Sales Invoice${inv.reference ? ` — ${inv.reference}` : ''}`,
        debit: inv.total,
        credit: 0,
        sortKey: `1_INV_${inv.number}`,
      })
    }

    // Credit notes — credit (we credited them)
    const creditNotes = await db.creditNote.findMany({
      where: {
        businessId, partyId, date: dateRange,
        status: { in: ['POSTED'] },
      },
      select: { number: true, date: true, total: true, reference: true, reason: true },
    })
    for (const cn of creditNotes) {
      rows.push({
        date: cn.date,
        type: 'CREDIT_NOTE',
        reference: cn.number,
        description: `Credit Note${cn.reason ? ` — ${cn.reason}` : ''}`,
        debit: 0,
        credit: cn.total,
        sortKey: `2_CN_${cn.number}`,
      })
    }
  }

  if (isSupplier) {
    // Purchase bills — credit (we owe them)
    const bills = await db.purchaseBill.findMany({
      where: {
        businessId, partyId, date: dateRange,
        status: { in: ['POSTED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { number: true, date: true, total: true, reference: true, supplierInvoiceNumber: true },
    })
    for (const b of bills) {
      rows.push({
        date: b.date,
        type: 'BILL',
        reference: b.number,
        description: `Purchase Bill${b.supplierInvoiceNumber ? ` — ${b.supplierInvoiceNumber}` : ''}`,
        debit: 0,
        credit: b.total,
        sortKey: `3_BILL_${b.number}`,
      })
    }
  }

  // Payments — depends on type
  // RECEIPT (customer paid us): credit (their balance decreases)
  // PAYMENT (we paid supplier): debit (their balance decreases — i.e. what we owe decreases)
  const payments = await db.payment.findMany({
    where: { businessId, partyId, date: dateRange, status: 'POSTED' },
    select: { number: true, date: true, amount: true, type: true, method: true, reference: true, description: true },
  })
  for (const p of payments) {
    const isReceipt = p.type === 'RECEIPT'
    rows.push({
      date: p.date,
      type: 'PAYMENT',
      reference: p.number,
      description: `${isReceipt ? 'Receipt' : 'Payment'} via ${p.method}${p.reference ? ` — ${p.reference}` : ''}${p.description ? ` (${p.description})` : ''}`,
      debit: isReceipt ? 0 : p.amount,
      credit: isReceipt ? p.amount : 0,
      sortKey: `0_PMT_${p.number}`,
    })
  }

  return rows
}

export async function computeAging(
  businessId: string,
  partyId: string,
  isCustomer: boolean,
  isSupplier: boolean,
  asOf: Date,
): Promise<{
  current: number
  days30: number
  days60: number
  days90: number
  over90: number
  total: number
}> {
  const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  const now = asOf

  if (isCustomer) {
    const invoices = await db.salesInvoice.findMany({
      where: {
        businessId, partyId, date: { lte: asOf },
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { dueDate: true, total: true, amountPaid: true },
    })
    for (const inv of invoices) {
      const balance = toNumber(money(inv.total).minus(money(inv.amountPaid)))
      if (balance <= 0) continue
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
      if (daysOverdue > 90) buckets.over90 += balance
      else if (daysOverdue > 60) buckets.days90 += balance
      else if (daysOverdue > 30) buckets.days60 += balance
      else if (daysOverdue > 0) buckets.days30 += balance
      else buckets.current += balance
    }
  }

  if (isSupplier) {
    const bills = await db.purchaseBill.findMany({
      where: {
        businessId, partyId, date: { lte: asOf },
        status: { in: ['POSTED', 'PARTIALLY_PAID', 'OVERDUE'] },
      },
      select: { dueDate: true, total: true, amountPaid: true },
    })
    for (const b of bills) {
      const balance = toNumber(money(b.total).minus(money(b.amountPaid)))
      if (balance <= 0) continue
      const daysOverdue = Math.floor((now.getTime() - new Date(b.dueDate).getTime()) / 86400000)
      if (daysOverdue > 90) buckets.over90 += balance
      else if (daysOverdue > 60) buckets.days90 += balance
      else if (daysOverdue > 30) buckets.days60 += balance
      else if (daysOverdue > 0) buckets.days30 += balance
      else buckets.current += balance
    }
  }

  const total = buckets.current + buckets.days30 + buckets.days60 + buckets.days90 + buckets.over90
  return { ...buckets, total }
}
