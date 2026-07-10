import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusinessId } from '@/lib/business-context'
import { postJournalEntry } from '@/lib/journal-service'
import { toNumber, money, isBalanced } from '@/lib/decimal'

// GET /api/journal — list journal entries
export async function GET(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')

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
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const body = await req.json()

  // Validate balance
  if (!isBalanced(body.lines)) {
    return NextResponse.json({ error: 'Journal entry not balanced (debits must equal credits)' }, { status: 400 })
  }

  // Get a user (single-user mode: find or create default user)
  let user = await db.user.findFirst()
  if (!user) {
    user = await db.user.create({ data: { email: 'admin@local', name: 'Admin', role: 'ADMIN' } })
  }

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
