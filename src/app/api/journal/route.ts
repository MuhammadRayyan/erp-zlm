import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession } from '@/lib/auth'
import { postJournalEntry } from '@/lib/journal-service'
import { toNumber, money, isBalanced } from '@/lib/decimal'

// GET /api/journal — list journal entries
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100)

  const entries = await db.journalEntry.findMany({
    where: { businessId },
    include: {
      lines: { include: { account: { select: { code: true, name: true } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return NextResponse.json(entries.map(e => ({
    id: e.id,
    number: e.number,
    date: e.date,
    reference: e.reference,
    description: e.description,
    sourceType: e.sourceType,
    isPosted: e.isPosted,
    isReversed: e.isReversed,
    createdBy: e.createdBy.name,
    totalDebit: toNumber(e.lines.reduce((s, l) => s.plus(money(l.debit)), money(0))),
    totalCredit: toNumber(e.lines.reduce((s, l) => s.plus(money(l.credit)), money(0))),
    lines: e.lines.map(l => ({
      id: l.id,
      accountCode: l.account.code,
      accountName: l.account.name,
      debit: toNumber(l.debit),
      credit: toNumber(l.credit),
      description: l.description,
    })),
  })))
}

// POST /api/journal — create journal entry
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()

  // Validate balance
  if (!isBalanced(body.lines)) {
    return NextResponse.json({ error: 'Journal entry not balanced (debits must equal credits)' }, { status: 400 })
  }

  // Get a user (single-user mode: find or create default user)
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }

  const entryId = await postJournalEntry({
    businessId,
    userId: user.id,
    date: new Date(body.date),
    reference: body.reference,
    description: body.description,
    sourceType: 'MANUAL',
    lines: body.lines,
  })

  const entry = await db.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: { include: { account: true } } },
  })
  return NextResponse.json(entry)
}
