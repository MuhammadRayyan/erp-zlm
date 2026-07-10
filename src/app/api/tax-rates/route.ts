import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId } from '@/lib/auth'
import { toNumber } from '@/lib/decimal'

// GET /api/tax-rates
export async function GET() {
  const businessId = await ensureBusinessId()
  

  const rates = await db.taxRate.findMany({
    where: { businessId },
    orderBy: { rate: 'desc' },
  })

  return NextResponse.json(rates.map(r => ({
    id: r.id, name: r.name, nameAr: r.nameAr, rate: toNumber(r.rate),
    category: r.category, isDefault: r.isDefault, isActive: r.isActive,
  })))
}

// POST
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()

  // If setting as default, unset others
  if (body.isDefault) {
    await db.taxRate.updateMany({ where: { businessId, isDefault: true }, data: { isDefault: false } })
  }

  const rate = await db.taxRate.create({
    data: {
      businessId,
      name: body.name,
      nameAr: body.nameAr || null,
      rate: body.rate,
      category: body.category || 'STANDARD_RATED',
      isDefault: body.isDefault || false,
      isActive: body.isActive !== false,
    },
  })
  return NextResponse.json(rate)
}

// PUT
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const businessId = await ensureBusinessId()
  const body = await req.json()

  if (body.isDefault) {
    await db.taxRate.updateMany({ where: { businessId, isDefault: true }, data: { isDefault: false } })
  }

  const rate = await db.taxRate.update({
    where: { id },
    data: {
      name: body.name, nameAr: body.nameAr || null, rate: body.rate,
      category: body.category, isDefault: body.isDefault, isActive: body.isActive,
    },
  })
  return NextResponse.json(rate)
}
