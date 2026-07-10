import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusinessId } from '@/lib/business-context'
import { toNumber } from '@/lib/decimal'

// GET /api/accounts — list all accounts (hierarchical)
export async function GET(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  const accounts = await db.account.findMany({
    where: { businessId, ...(type ? { type } : {}) },
    include: {
      _count: { select: { journalLines: true } },
    },
    orderBy: [{ type: 'asc' }, { code: 'asc' }],
  })

  return NextResponse.json(accounts.map(a => ({
    id: a.id,
    code: a.code,
    name: a.name,
    nameAr: a.nameAr,
    type: a.type,
    subtype: a.subtype,
    parentId: a.parentId,
    description: a.description,
    isControl: a.isControl,
    isSystem: a.isSystem,
    isActive: a.isActive,
    openingBalance: toNumber(a.openingBalance),
    hasTransactions: a._count.journalLines > 0,
  })))
}

// POST /api/accounts — create account
export async function POST(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const body = await req.json()
  const account = await db.account.create({
    data: {
      businessId,
      code: body.code,
      name: body.name,
      nameAr: body.nameAr || null,
      type: body.type,
      subtype: body.subtype || null,
      parentId: body.parentId || null,
      description: body.description || null,
      isControl: body.isControl || false,
      openingBalance: body.openingBalance || 0,
      isActive: body.isActive !== false,
    },
  })
  return NextResponse.json(account)
}

// PUT /api/accounts?id=xxx — update account
export async function PUT(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await req.json()
  const account = await db.account.update({
    where: { id },
    data: {
      code: body.code,
      name: body.name,
      nameAr: body.nameAr || null,
      type: body.type,
      subtype: body.subtype || null,
      parentId: body.parentId || null,
      description: body.description || null,
      isControl: body.isControl,
      openingBalance: body.openingBalance || 0,
      isActive: body.isActive,
    },
  })
  return NextResponse.json(account)
}

// DELETE /api/accounts?id=xxx
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const account = await db.account.findUnique({ where: { id } })
  if (account?.isSystem) {
    return NextResponse.json({ error: 'System accounts cannot be deleted' }, { status: 400 })
  }

  await db.account.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
