import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureDefaultBusiness } from '@/lib/business-context'
import { money, toNumber, Decimal } from '@/lib/decimal'

// GET /api/reports?type=trial_balance|profit_loss|balance_sheet|vat_return|aged_receivables|aged_payables
export async function GET(req: NextRequest) {
  const businessId = await ensureDefaultBusiness()
  

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(new Date().getFullYear(), 0, 1)
  const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date()

  if (type === 'trial_balance') {
    return trialBalance(businessId, endDate)
  }
  if (type === 'profit_loss') {
    return profitLoss(businessId, startDate, endDate)
  }
  if (type === 'balance_sheet') {
    return balanceSheet(businessId, endDate)
  }
  if (type === 'vat_return') {
    return vatReturn(businessId, startDate, endDate)
  }
  if (type === 'aged_receivables') {
    return agedReceivables(businessId)
  }
  if (type === 'aged_payables') {
    return agedPayables(businessId)
  }
  if (type === 'general_ledger') {
    return generalLedger(businessId, startDate, endDate)
  }

  return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
}

async function trialBalance(businessId: string, asOf: Date) {
  const accounts = await db.account.findMany({
    where: { businessId, isActive: true },
    include: {
      journalLines: {
        where: { journalEntry: { isPosted: true, date: { lte: asOf } } },
        select: { debit: true, credit: true },
      },
    },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  })

  const rows = accounts.map(a => {
    const debit = a.journalLines.reduce((s, l) => s.plus(money(l.debit)), money(0))
    const credit = a.journalLines.reduce((s, l) => s.plus(money(l.credit)), money(0))
    const balance = debit.minus(credit)
    const isDebitType = a.type === 'ASSET' || a.type === 'EXPENSE'
    return {
      code: a.code, name: a.name, type: a.type, subtype: a.subtype,
      debit: isDebitType ? toNumber(balance.abs()) : 0,
      credit: !isDebitType && balance.lt(0) ? toNumber(balance.abs()) : 0,
      balance: toNumber(balance),
    }
  }).filter(r => r.balance !== 0 || r.debit !== 0 || r.credit !== 0)

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

  return NextResponse.json({ asOf: asOf.toISOString(), rows, totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 })
}

async function profitLoss(businessId: string, startDate: Date, endDate: Date) {
  const incomeAccounts = await db.account.findMany({
    where: { businessId, type: 'INCOME', isActive: true },
    include: {
      journalLines: {
        where: { journalEntry: { isPosted: true, date: { gte: startDate, lte: endDate } } },
        select: { debit: true, credit: true },
      },
    },
  })
  const expenseAccounts = await db.account.findMany({
    where: { businessId, type: 'EXPENSE', isActive: true },
    include: {
      journalLines: {
        where: { journalEntry: { isPosted: true, date: { gte: startDate, lte: endDate } } },
        select: { debit: true, credit: true },
      },
    },
  })

  const income = incomeAccounts.map(a => {
    const debit = a.journalLines.reduce((s, l) => s.plus(money(l.debit)), money(0))
    const credit = a.journalLines.reduce((s, l) => s.plus(money(l.credit)), money(0))
    return { code: a.code, name: a.name, subtype: a.subtype, amount: toNumber(credit.minus(debit)) }
  })
  const expenses = expenseAccounts.map(a => {
    const debit = a.journalLines.reduce((s, l) => s.plus(money(l.debit)), money(0))
    const credit = a.journalLines.reduce((s, l) => s.plus(money(l.credit)), money(0))
    return { code: a.code, name: a.name, subtype: a.subtype, amount: toNumber(debit.minus(credit)) }
  })

  const totalIncome = income.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0)
  const netProfit = totalIncome - totalExpenses

  return NextResponse.json({
    startDate: startDate.toISOString(), endDate: endDate.toISOString(),
    income, expenses, totalIncome, totalExpenses, netProfit,
  })
}

async function balanceSheet(businessId: string, asOf: Date) {
  const assetAccounts = await db.account.findMany({
    where: { businessId, type: 'ASSET', isActive: true },
    include: {
      journalLines: {
        where: { journalEntry: { isPosted: true, date: { lte: asOf } } },
        select: { debit: true, credit: true },
      },
    },
  })
  const liabilityAccounts = await db.account.findMany({
    where: { businessId, type: 'LIABILITY', isActive: true },
    include: {
      journalLines: {
        where: { journalEntry: { isPosted: true, date: { lte: asOf } } },
        select: { debit: true, credit: true },
      },
    },
  })
  const equityAccounts = await db.account.findMany({
    where: { businessId, type: 'EQUITY', isActive: true },
    include: {
      journalLines: {
        where: { journalEntry: { isPosted: true, date: { lte: asOf } } },
        select: { debit: true, credit: true },
      },
    },
  })

  const calc = (accounts: typeof assetAccounts) => accounts.map(a => {
    const debit = a.journalLines.reduce((s, l) => s.plus(money(l.debit)), money(0))
    const credit = a.journalLines.reduce((s, l) => s.plus(money(l.credit)), money(0))
    return { code: a.code, name: a.name, subtype: a.subtype, amount: toNumber(debit.minus(credit)) }
  })

  const assets = calc(assetAccounts)
  const liabilities = calc(liabilityAccounts).map(l => ({ ...l, amount: -l.amount })) // liabilities have credit balance
  const equity = calc(equityAccounts).map(e => ({ ...e, amount: -e.amount }))

  // Calculate retained earnings = net profit (income - expenses) up to asOf
  const incomeAccounts = await db.account.findMany({
    where: { businessId, type: 'INCOME', isActive: true },
    include: { journalLines: { where: { journalEntry: { isPosted: true, date: { lte: asOf } } }, select: { debit: true, credit: true } } },
  })
  const expenseAccounts = await db.account.findMany({
    where: { businessId, type: 'EXPENSE', isActive: true },
    include: { journalLines: { where: { journalEntry: { isPosted: true, date: { lte: asOf } } }, select: { debit: true, credit: true } } },
  })
  const totalIncome = incomeAccounts.reduce((s, a) => {
    const debit = a.journalLines.reduce((sd, l) => sd.plus(money(l.debit)), money(0))
    const credit = a.journalLines.reduce((sc, l) => sc.plus(money(l.credit)), money(0))
    return s.plus(credit.minus(debit))
  }, money(0))
  const totalExpenses = expenseAccounts.reduce((s, a) => {
    const debit = a.journalLines.reduce((sd, l) => sd.plus(money(l.debit)), money(0))
    const credit = a.journalLines.reduce((sc, l) => sc.plus(money(l.credit)), money(0))
    return s.plus(debit.minus(credit))
  }, money(0))
  const retainedEarnings = toNumber(totalIncome.minus(totalExpenses))

  const totalAssets = assets.reduce((s, a) => s + a.amount, 0)
  const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0)
  const totalEquity = equity.reduce((s, e) => s + e.amount, 0) + retainedEarnings

  return NextResponse.json({
    asOf: asOf.toISOString(),
    assets, liabilities, equity,
    retainedEarnings,
    totalAssets, totalLiabilities, totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  })
}

async function vatReturn(businessId: string, startDate: Date, endDate: Date) {
  // Output VAT from sales invoices
  const invoices = await db.salesInvoice.findMany({
    where: { businessId, date: { gte: startDate, lte: endDate }, status: { in: ['POSTED', 'PAID', 'PARTIALLY_PAID'] } },
    select: { totalTax: true, total: true, subtotal: true },
  })
  const outputVAT = invoices.reduce((s, inv) => s + toNumber(money(inv.totalTax)), 0)
  const totalSales = invoices.reduce((s, inv) => s + toNumber(money(inv.subtotal)), 0)

  // Input VAT from purchase bills
  const bills = await db.purchaseBill.findMany({
    where: { businessId, date: { gte: startDate, lte: endDate }, status: { in: ['POSTED', 'PAID', 'PARTIALLY_PAID'] } },
    select: { totalTax: true, subtotal: true },
  })
  const inputVAT = bills.reduce((s, b) => s + toNumber(money(b.totalTax)), 0)
  const totalPurchases = bills.reduce((s, b) => s + toNumber(money(b.subtotal)), 0)

  const netVAT = outputVAT - inputVAT

  return NextResponse.json({
    startDate: startDate.toISOString(), endDate: endDate.toISOString(),
    outputVAT, inputVAT, netVAT: Math.round(netVAT * 100) / 100,
    totalSales, totalPurchases,
    payable: netVAT > 0 ? netVAT : 0,
    refundable: netVAT < 0 ? Math.abs(netVAT) : 0,
    invoiceCount: invoices.length,
    billCount: bills.length,
  })
}

async function agedReceivables(businessId: string) {
  const invoices = await db.salesInvoice.findMany({
    where: { businessId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'OVERDUE'] } },
    include: { party: { select: { name: true } } },
  })

  const now = new Date()
  const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  const rows = invoices.map(inv => {
    const balance = toNumber(money(inv.total).minus(money(inv.amountPaid)))
    if (balance <= 0) return null
    const dueDate = new Date(inv.dueDate)
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    let bucket = 'current'
    if (daysOverdue > 90) bucket = 'over90'
    else if (daysOverdue > 60) bucket = 'days90'
    else if (daysOverdue > 30) bucket = 'days60'
    else if (daysOverdue > 0) bucket = 'days30'
    buckets[bucket as keyof typeof buckets] += balance
    return {
      invoiceNumber: inv.number, partyName: inv.party.name, date: inv.date,
      dueDate: inv.dueDate, total: toNumber(inv.total), balance, daysOverdue,
      bucket,
    }
  }).filter(Boolean)

  return NextResponse.json({ rows, buckets, total: rows.reduce((s, r) => s + (r?.balance || 0), 0) })
}

async function agedPayables(businessId: string) {
  const bills = await db.purchaseBill.findMany({
    where: { businessId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'OVERDUE'] } },
    include: { party: { select: { name: true } } },
  })

  const now = new Date()
  const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  const rows = bills.map(b => {
    const balance = toNumber(money(b.total).minus(money(b.amountPaid)))
    if (balance <= 0) return null
    const dueDate = new Date(b.dueDate)
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    let bucket = 'current'
    if (daysOverdue > 90) bucket = 'over90'
    else if (daysOverdue > 60) bucket = 'days90'
    else if (daysOverdue > 30) bucket = 'days60'
    else if (daysOverdue > 30) bucket = 'days60'
    else if (daysOverdue > 0) bucket = 'days30'
    buckets[bucket as keyof typeof buckets] += balance
    return {
      billNumber: b.number, partyName: b.party.name, date: b.date,
      dueDate: b.dueDate, total: toNumber(b.total), balance, daysOverdue,
      bucket,
    }
  }).filter(Boolean)

  return NextResponse.json({ rows, buckets, total: rows.reduce((s, r) => s + (r?.balance || 0), 0) })
}

async function generalLedger(businessId: string, startDate: Date, endDate: Date) {
  const entries = await db.journalEntry.findMany({
    where: { businessId, isPosted: true, date: { gte: startDate, lte: endDate } },
    include: { lines: { include: { account: { select: { code: true, name: true, type: true } } } } },
    orderBy: { date: 'asc' },
  })

  const lines: Array<{
    date: Date; entryNumber: string; accountCode: string; accountName: string;
    description: string | null; debit: number; credit: number; reference: string | null;
  }> = []
  for (const e of entries) {
    for (const l of e.lines) {
      lines.push({
        date: e.date, entryNumber: e.number, accountCode: l.account.code,
        accountName: l.account.name, description: l.description,
        debit: toNumber(l.debit), credit: toNumber(l.credit), reference: e.reference,
      })
    }
  }

  return NextResponse.json({ startDate: startDate.toISOString(), endDate: endDate.toISOString(), lines })
}
