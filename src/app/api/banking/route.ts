import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId } from '@/lib/auth'
import { toNumber } from '@/lib/decimal'

// GET /api/banking — bank accounts
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const accounts = await db.bankAccount.findMany({
    where: { businessId },
    include: { _count: { select: { transactions: true } } },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(accounts.map(a => ({
    id: a.id, name: a.name, accountNumber: a.accountNumber, bankName: a.bankName,
    branch: a.branch, iban: a.iban, 
    openingBalance: toNumber(a.openingBalance), currentBalance: toNumber(a.currentBalance),
    currency: a.currency, isActive: a.isActive,
    transactionCount: a._count.transactions,
  })))
}

// POST
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const account = await db.bankAccount.create({
    data: {
      businessId,
      name: body.name,
      accountNumber: body.accountNumber || null,
      bankName: body.bankName || null,
      branch: body.branch || null,
      iban: body.iban || null,
      
      openingBalance: body.openingBalance || 0,
      currentBalance: body.openingBalance || 0,
      currency: body.currency || 'AED',
      isActive: body.isActive !== false,
    },
  })
  return NextResponse.json(account)
}

// PUT
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await req.json()
  const account = await db.bankAccount.update({
    where: { id },
    data: {
      name: body.name, accountNumber: body.accountNumber || null,
      bankName: body.bankName || null, iban: body.iban || null,
      currency: body.currency, isActive: body.isActive,
    },
  })
  return NextResponse.json(account)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.bankAccount.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
