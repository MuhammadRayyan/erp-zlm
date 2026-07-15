import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { toNumber, money } from '@/lib/decimal'

// GET /api/accounts/transactions?accountId=xxx&startDate=xxx&endDate=xxx
// Returns all journal lines for a specific account (drill-down)
export async function GET(req: NextRequest) {
  let businessId: string
  try { businessId = await ensureBusinessId() } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined
  const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined

  if (!accountId) {
    return NextResponse.json({ error: 'accountId required' }, { status: 400 })
  }

  // Verify account belongs to business
  const account = await db.account.findFirst({ where: { id: accountId, businessId } })
  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // Get all journal lines for this account
  const where: { accountId: string; journalEntry?: { isPosted: boolean; date?: { gte?: Date; lte?: Date } } } = {
    accountId,
    journalEntry: { isPosted: true },
  }
  if (startDate || endDate) {
    where.journalEntry!.date = {}
    if (startDate) where.journalEntry!.date!.gte = startDate
    if (endDate) where.journalEntry!.date!.lte = endDate
  }

  const lines = await db.journalLine.findMany({
    where,
    include: {
      journalEntry: {
        include: { createdBy: { select: { name: true } } },
      },
    },
    orderBy: { journalEntry: { date: 'asc' } },
  })

  // Calculate running balance
  let runningBalance = money(0)
  const transactions = lines.map(l => {
    const debit = toNumber(l.debit)
    const credit = toNumber(l.credit)
    runningBalance = runningBalance.plus(money(l.debit)).minus(money(l.credit))
    return {
      id: l.id,
      date: l.journalEntry.date,
      entryNumber: l.journalEntry.number,
      reference: l.journalEntry.reference,
      description: l.description || l.journalEntry.description,
      sourceType: l.journalEntry.sourceType,
      debit,
      credit,
      balance: toNumber(runningBalance),
      createdBy: l.journalEntry.createdBy.name,
    }
  })

  // Summary
  const totalDebit = toNumber(lines.reduce((s, l) => s.plus(money(l.debit)), money(0)))
  const totalCredit = toNumber(lines.reduce((s, l) => s.plus(money(l.credit)), money(0)))

  return NextResponse.json({
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
    },
    transactions,
    summary: {
      totalDebit,
      totalCredit,
      balance: totalDebit - totalCredit,
      count: transactions.length,
    },
  })
}
