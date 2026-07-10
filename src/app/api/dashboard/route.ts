import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureDefaultBusiness } from '@/lib/business-context'
import { Decimal, money, toNumber } from '@/lib/decimal'

// GET /api/dashboard — KPIs and recent activity
export async function GET() {
  const businessId = await ensureDefaultBusiness()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  // Total receivables
  const invoices = await db.salesInvoice.findMany({
    where: { businessId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'OVERDUE'] } },
    select: { total: true, amountPaid: true },
  })
  const totalReceivables = invoices.reduce(
    (s, inv) => s.plus(money(inv.total).minus(money(inv.amountPaid))),
    money(0)
  )

  // Total payables
  const bills = await db.purchaseBill.findMany({
    where: { businessId, status: { in: ['POSTED', 'PARTIALLY_PAID', 'OVERDUE'] } },
    select: { total: true, amountPaid: true },
  })
  const totalPayables = bills.reduce(
    (s, b) => s.plus(money(b.total).minus(money(b.amountPaid))),
    money(0)
  )

  // This month income
  const monthInvoices = await db.salesInvoice.findMany({
    where: { businessId, date: { gte: startOfMonth }, status: { not: 'DRAFT' } },
    select: { total: true },
  })
  const monthIncome = monthInvoices.reduce((s, i) => s.plus(money(i.total)), money(0))

  // Previous month income
  const prevMonthInvoices = await db.salesInvoice.findMany({
    where: { businessId, date: { gte: startOfPrevMonth, lt: startOfMonth }, status: { not: 'DRAFT' } },
    select: { total: true },
  })
  const prevMonthIncome = prevMonthInvoices.reduce((s, i) => s.plus(money(i.total)), money(0))

  // This month expenses
  const monthBills = await db.purchaseBill.findMany({
    where: { businessId, date: { gte: startOfMonth }, status: { not: 'DRAFT' } },
    select: { total: true },
  })
  const monthExpenses = monthBills.reduce((s, b) => s.plus(money(b.total)), money(0))

  const counts = {
    invoices: await db.salesInvoice.count({ where: { businessId } }),
    bills: await db.purchaseBill.count({ where: { businessId } }),
    customers: await db.party.count({ where: { businessId, type: { in: ['CUSTOMER', 'BOTH'] } } }),
    suppliers: await db.party.count({ where: { businessId, type: { in: ['SUPPLIER', 'BOTH'] } } }),
    draftInvoices: await db.salesInvoice.count({ where: { businessId, status: 'DRAFT' } }),
    overdueInvoices: await db.salesInvoice.count({ where: { businessId, status: 'OVERDUE' } }),
  }

  const recentInvoices = await db.salesInvoice.findMany({
    where: { businessId },
    include: { party: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  // Monthly revenue (last 6 months)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const allInvoices = await db.salesInvoice.findMany({
    where: { businessId, date: { gte: sixMonthsAgo }, status: { not: 'DRAFT' } },
    select: { date: true, total: true },
  })
  const monthlyRevenue: { month: string; revenue: number; expenses: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const revenue = allInvoices
      .filter(inv => inv.date >= mStart && inv.date < mEnd)
      .reduce((s, inv) => s + toNumber(inv.total), 0)
    monthlyRevenue.push({
      month: mStart.toLocaleDateString('en', { month: 'short' }),
      revenue: Math.round(revenue * 100) / 100,
      expenses: 0,
    })
  }
  const allBills = await db.purchaseBill.findMany({
    where: { businessId, date: { gte: sixMonthsAgo }, status: { not: 'DRAFT' } },
    select: { date: true, total: true },
  })
  for (let i = 0; i < 6; i++) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() - 5 + i + 1, 1)
    monthlyRevenue[i].expenses = Math.round(
      allBills.filter(b => b.date >= mStart && b.date < mEnd).reduce((s, b) => s + toNumber(b.total), 0) * 100
    ) / 100
  }

  const overdueInvoices = await db.salesInvoice.findMany({
    where: { businessId, status: 'OVERDUE' },
    include: { party: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
    take: 10,
  })

  return NextResponse.json({
    kpis: {
      totalReceivables: toNumber(totalReceivables),
      totalPayables: toNumber(totalPayables),
      monthIncome: toNumber(monthIncome),
      prevMonthIncome: toNumber(prevMonthIncome),
      monthExpenses: toNumber(monthExpenses),
      netCashFlow: toNumber(monthIncome.minus(monthExpenses)),
    },
    counts,
    recentInvoices: recentInvoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      partyName: inv.party.name,
      total: toNumber(inv.total),
      status: inv.status,
    })),
    overdueInvoices: overdueInvoices.map(inv => ({
      id: inv.id,
      number: inv.number,
      partyName: inv.party.name,
      dueDate: inv.dueDate,
      total: toNumber(inv.total),
      amountPaid: toNumber(inv.amountPaid),
    })),
    monthlyRevenue,
  })
}
