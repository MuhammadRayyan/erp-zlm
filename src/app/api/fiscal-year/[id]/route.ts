import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, hasPermission, AuthError } from '@/lib/auth'
import { postJournalEntry } from '@/lib/journal-service'
import { money, toNumber, Decimal } from '@/lib/decimal'
import { logActivity, logAudit, getClientIp } from '@/lib/activity-logger'

// ============================================================
// FISCAL YEAR [id] — details, close
// ============================================================

// GET /api/fiscal-year/[id] — fiscal year details + net income calculation
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { id } = await params
  const fy = await db.fiscalYear.findFirst({
    where: { id, businessId },
    include: { closedByUser: { select: { id: true, name: true, email: true } } },
  })
  if (!fy) return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 })

  // Compute net income (income - expenses) for the fiscal year period based
  // on posted journal entries. Income accounts normally have credit balances;
  // expense accounts have debit balances. Net income = total income - total expenses.
  const incomeAccounts = await db.account.findMany({
    where: { businessId, type: 'INCOME', isActive: true },
    select: { id: true, code: true, name: true },
  })
  const expenseAccounts = await db.account.findMany({
    where: { businessId, type: 'EXPENSE', isActive: true },
    select: { id: true, code: true, name: true },
  })

  const incomeLines = await db.journalLine.findMany({
    where: {
      accountId: { in: incomeAccounts.map(a => a.id) },
      journalEntry: {
        businessId,
        isPosted: true,
        isReversed: false,
        date: { gte: fy.startDate, lte: fy.endDate },
      },
    },
    select: { accountId: true, debit: true, credit: true },
  })
  const expenseLines = await db.journalLine.findMany({
    where: {
      accountId: { in: expenseAccounts.map(a => a.id) },
      journalEntry: {
        businessId,
        isPosted: true,
        isReversed: false,
        date: { gte: fy.startDate, lte: fy.endDate },
      },
    },
    select: { accountId: true, debit: true, credit: true },
  })

  // Income = credit - debit (credit-normal account)
  // Expense = debit - credit (debit-normal account)
  const incomeByAccount = new Map<string, Decimal>()
  for (const l of incomeLines) {
    const delta = money(l.credit).minus(money(l.debit))
    incomeByAccount.set(l.accountId, (incomeByAccount.get(l.accountId) || money(0)).plus(delta))
  }
  const expenseByAccount = new Map<string, Decimal>()
  for (const l of expenseLines) {
    const delta = money(l.debit).minus(money(l.credit))
    expenseByAccount.set(l.accountId, (expenseByAccount.get(l.accountId) || money(0)).plus(delta))
  }

  const totalIncome = Array.from(incomeByAccount.values()).reduce((s, v) => s.plus(v), money(0))
  const totalExpense = Array.from(expenseByAccount.values()).reduce((s, v) => s.plus(v), money(0))
  const netIncome = totalIncome.minus(totalExpense)

  // Check period lock status — all 12 months in the fiscal year must be locked
  // (or the entire year must be locked).
  const startDate = new Date(fy.startDate)
  const endDate = new Date(fy.endDate)
  const startYear = startDate.getUTCFullYear()
  const endYear = endDate.getUTCFullYear()
  const yearsSpan: number[] = []
  for (let y = startYear; y <= endYear; y++) yearsSpan.push(y)

  const locks = await db.periodLock.findMany({ where: { businessId, year: { in: yearsSpan } } })
  const fullYearLocked = new Set<number>()
  const monthLocked = new Set<string>()
  for (const l of locks) {
    if (l.month === 0) fullYearLocked.add(l.year)
    else monthLocked.add(`${l.year}-${l.month}`)
  }

  // For each month inside [startDate, endDate], check if locked (either by month or whole year)
  const missingLocks: string[] = []
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))
  while (cursor <= endDate) {
    const y = cursor.getUTCFullYear()
    const m = cursor.getUTCMonth() + 1
    const locked = fullYearLocked.has(y) || monthLocked.has(`${y}-${m}`)
    if (!locked) missingLocks.push(`${y}-${String(m).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return NextResponse.json({
    id: fy.id,
    businessId: fy.businessId,
    name: fy.name,
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: fy.status,
    closedAt: fy.closedAt,
    closedBy: fy.closedBy,
    closedByName: fy.closedByUser?.name || null,
    closedByEmail: fy.closedByUser?.email || null,
    createdAt: fy.createdAt,
    netIncome: toNumber(netIncome),
    totalIncome: toNumber(totalIncome),
    totalExpense: toNumber(totalExpense),
    allPeriodsLocked: missingLocks.length === 0,
    missingLocks,
    incomeBreakdown: incomeAccounts
      .map(a => ({ code: a.code, name: a.name, amount: toNumber(incomeByAccount.get(a.id) || money(0)) }))
      .filter(a => a.amount !== 0),
    expenseBreakdown: expenseAccounts
      .map(a => ({ code: a.code, name: a.name, amount: toNumber(expenseByAccount.get(a.id) || money(0)) }))
      .filter(a => a.amount !== 0),
  })
}

// POST /api/fiscal-year/[id] — close the fiscal year
// Body: { action: 'close' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json(
      { error: 'Only tenant administrators can close fiscal years' },
      { status: 403 },
    )
  }

  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = (body.action || '').toString()

  if (action !== 'close') {
    return NextResponse.json({ error: 'Unknown action. Use action=close.' }, { status: 400 })
  }

  const fy = await db.fiscalYear.findFirst({ where: { id, businessId } })
  if (!fy) return NextResponse.json({ error: 'Fiscal year not found' }, { status: 404 })
  if (fy.status === 'CLOSED') {
    return NextResponse.json({ error: 'Fiscal year is already closed' }, { status: 400 })
  }

  // Mark as CLOSING (intermediate state) so UI/operators can see it is in
  // progress. Closing is irreversible.
  await db.fiscalYear.update({ where: { id }, data: { status: 'CLOSING' } })

  try {
    // 1. Verify all periods in the fiscal year are locked
    const startDate = new Date(fy.startDate)
    const endDate = new Date(fy.endDate)
    const startYear = startDate.getUTCFullYear()
    const endYear = endDate.getUTCFullYear()
    const yearsSpan: number[] = []
    for (let y = startYear; y <= endYear; y++) yearsSpan.push(y)

    const locks = await db.periodLock.findMany({ where: { businessId, year: { in: yearsSpan } } })
    const fullYearLocked = new Set<number>()
    const monthLocked = new Set<string>()
    for (const l of locks) {
      if (l.month === 0) fullYearLocked.add(l.year)
      else monthLocked.add(`${l.year}-${l.month}`)
    }
    const missingLocks: string[] = []
    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1))
    while (cursor <= endDate) {
      const y = cursor.getUTCFullYear()
      const m = cursor.getUTCMonth() + 1
      if (!fullYearLocked.has(y) && !monthLocked.has(`${y}-${m}`)) {
        missingLocks.push(`${y}-${String(m).padStart(2, '0')}`)
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
    if (missingLocks.length > 0) {
      // Revert CLOSING status since we cannot proceed
      await db.fiscalYear.update({ where: { id }, data: { status: 'OPEN' } })
      return NextResponse.json(
        {
          error: `Cannot close fiscal year: ${missingLocks.length} period(s) not locked`,
          missingLocks,
        },
        { status: 400 },
      )
    }

    // 2. Calculate net income
    const incomeAccounts = await db.account.findMany({
      where: { businessId, type: 'INCOME', isActive: true },
      select: { id: true, code: true, name: true },
    })
    const expenseAccounts = await db.account.findMany({
      where: { businessId, type: 'EXPENSE', isActive: true },
      select: { id: true, code: true, name: true },
    })

    const incomeLines = await db.journalLine.findMany({
      where: {
        accountId: { in: incomeAccounts.map(a => a.id) },
        journalEntry: {
          businessId,
          isPosted: true,
          isReversed: false,
          date: { gte: fy.startDate, lte: fy.endDate },
        },
      },
      select: { accountId: true, debit: true, credit: true },
    })
    const expenseLines = await db.journalLine.findMany({
      where: {
        accountId: { in: expenseAccounts.map(a => a.id) },
        journalEntry: {
          businessId,
          isPosted: true,
          isReversed: false,
          date: { gte: fy.startDate, lte: fy.endDate },
        },
      },
      select: { accountId: true, debit: true, credit: true },
    })

    const incomeByAccount = new Map<string, Decimal>()
    for (const l of incomeLines) {
      const delta = money(l.credit).minus(money(l.debit))
      incomeByAccount.set(l.accountId, (incomeByAccount.get(l.accountId) || money(0)).plus(delta))
    }
    const expenseByAccount = new Map<string, Decimal>()
    for (const l of expenseLines) {
      const delta = money(l.debit).minus(money(l.credit))
      expenseByAccount.set(l.accountId, (expenseByAccount.get(l.accountId) || money(0)).plus(delta))
    }

    const totalIncome = Array.from(incomeByAccount.values()).reduce((s, v) => s.plus(v), money(0))
    const totalExpense = Array.from(expenseByAccount.values()).reduce((s, v) => s.plus(v), money(0))
    const netIncome = totalIncome.minus(totalExpense)

    // 3. Create the closing journal entry — Debit Income Summary, Credit
    //    Retained Earnings (for net income). For net loss, the entry reverses.
    //    We create or reuse an "Income Summary" equity account (code 3900).
    //    The Retained Earnings account (code 3200) is part of the seeded
    //    UAE chart of accounts.
    const incomeSummaryAccount =
      (await db.account.findFirst({ where: { businessId, code: '3900' } })) ||
      (await db.account.create({
        data: {
          businessId,
          code: '3900',
          name: 'Income Summary',
          type: 'EQUITY',
          subtype: 'OTHER_EQUITY',
          isSystem: true,
          isActive: true,
          openingBalance: 0,
        },
      }))

    const retainedEarningsAccount = await db.account.findFirst({
      where: { businessId, code: '3200' },
    })

    if (!retainedEarningsAccount) {
      // Revert CLOSING — chart of accounts appears unseeded
      await db.fiscalYear.update({ where: { id }, data: { status: 'OPEN' } })
      return NextResponse.json(
        { error: 'Retained Earnings account (3200) not found. Ensure chart of accounts is seeded.' },
        { status: 500 },
      )
    }

    const closingDate = new Date(endDate)
    const absNet = netIncome.abs()
    const closingJournalLines: {
      accountId: string
      debit: string | number
      credit: string | number
      description: string
    }[] = []

    if (netIncome.gt(0)) {
      // Profit: Debit Income Summary, Credit Retained Earnings
      closingJournalLines.push({
        accountId: incomeSummaryAccount.id,
        debit: absNet.toFixed(2),
        credit: 0,
        description: `Closing entry — net income for ${fy.name}`,
      })
      closingJournalLines.push({
        accountId: retainedEarningsAccount.id,
        debit: 0,
        credit: absNet.toFixed(2),
        description: `Retained earnings — net income for ${fy.name}`,
      })
    } else if (netIncome.lt(0)) {
      // Loss: Debit Retained Earnings, Credit Income Summary
      closingJournalLines.push({
        accountId: retainedEarningsAccount.id,
        debit: absNet.toFixed(2),
        credit: 0,
        description: `Retained earnings — net loss for ${fy.name}`,
      })
      closingJournalLines.push({
        accountId: incomeSummaryAccount.id,
        debit: 0,
        credit: absNet.toFixed(2),
        description: `Closing entry — net loss for ${fy.name}`,
      })
    }
    // If net income is exactly 0, no closing entry is needed.

    if (closingJournalLines.length > 0) {
      await postJournalEntry({
        businessId,
        userId: session.userId,
        date: closingDate,
        reference: `Closing Entry — ${fy.name}`,
        description: `Fiscal year close: ${fy.name} (net income ${netIncome.toFixed(2)})`,
        sourceType: 'FISCAL_YEAR_CLOSE',
        sourceId: fy.id,
        lines: closingJournalLines,
      })
    }

    // 4. Mark fiscal year as CLOSED
    await db.fiscalYear.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: session.userId,
      },
    })

    // 5. Create the next fiscal year automatically if it doesn't exist.
    //    Next FY starts the day after this one ends; duration is the same
    //    as the current fiscal year (typically 365/366 days).
    const nextStart = new Date(endDate)
    nextStart.setUTCDate(nextStart.getUTCDate() + 1)
    const durationMs = endDate.getTime() - startDate.getTime()
    const nextEnd = new Date(nextStart.getTime() + durationMs)
    const nextName = `FY ${nextStart.getUTCFullYear()}`
    const existingNext = await db.fiscalYear.findUnique({
      where: { businessId_startDate: { businessId, startDate: nextStart } },
    })
    let nextFiscalYearId: string | null = null
    if (!existingNext) {
      const created = await db.fiscalYear.create({
        data: {
          businessId,
          name: nextName,
          startDate: nextStart,
          endDate: nextEnd,
          status: 'OPEN',
        },
      })
      nextFiscalYearId = created.id
    }

    // Activity + Audit logging (fire-and-forget)
    const tenantId = await getCurrentTenantId()
    void logActivity(businessId, session.userId, 'FISCAL_YEAR', id, 'CLOSED',
      `Fiscal year ${fy.name} closed. Net income: ${netIncome.toFixed(2)}`,
      { netIncome: toNumber(netIncome), totalIncome: toNumber(totalIncome), totalExpense: toNumber(totalExpense) })
    if (tenantId) {
      void logAudit(businessId, tenantId, session.userId, 'CLOSED', 'FISCAL_YEAR', id,
        `Fiscal year ${fy.name} closed`, undefined, getClientIp(req))
    }

    return NextResponse.json({
      ok: true,
      id,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      closedBy: session.userId,
      netIncome: toNumber(netIncome),
      totalIncome: toNumber(totalIncome),
      totalExpense: toNumber(totalExpense),
      nextFiscalYearId,
    })
  } catch (err) {
    // Revert CLOSING on unexpected error
    try {
      await db.fiscalYear.update({ where: { id }, data: { status: 'OPEN' } })
    } catch {
      // ignore
    }
    console.error('[fiscal-year/close] error:', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to close fiscal year' },
      { status: 500 },
    )
  }
}
