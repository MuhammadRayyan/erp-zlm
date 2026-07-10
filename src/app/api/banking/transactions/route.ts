import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusinessId } from '@/lib/business-context'
import { toNumber } from '@/lib/decimal'

// GET /api/banking/transactions?accountId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')

  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

  const transactions = await db.bankTransaction.findMany({
    where: { bankAccountId: accountId },
    orderBy: { date: 'desc' },
    take: 100,
  })

  return NextResponse.json(transactions.map(t => ({
    id: t.id, date: t.date, description: t.description, reference: t.reference,
    amount: toNumber(t.amount), type: t.type, isReconciled: t.isReconciled,
  })))
}

// POST — add transaction
export async function POST(req: NextRequest) {
  const body = await req.json()
  const amount = Number(body.amount)
  const tx = await db.bankTransaction.create({
    data: {
      bankAccountId: body.bankAccountId,
      date: new Date(body.date),
      description: body.description || null,
      reference: body.reference || null,
      amount: body.type === 'WITHDRAWAL' ? -Math.abs(amount) : Math.abs(amount),
      type: body.type || 'DEPOSIT',
    },
  })

  // Update bank account balance
  const ba = await db.bankAccount.findUnique({ where: { id: body.bankAccountId } })
  if (ba) {
    const newBalance = Number(ba.currentBalance) + (body.type === 'WITHDRAWAL' ? -Math.abs(amount) : Math.abs(amount))
    await db.bankAccount.update({ where: { id: ba.id }, data: { currentBalance: newBalance } })
  }

  return NextResponse.json(tx)
}
