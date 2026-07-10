import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureDefaultBusiness } from '@/lib/business-context'
import { toNumber } from '@/lib/decimal'

// GET /api/items
export async function GET(req: NextRequest) {
  const businessId = await ensureDefaultBusiness()
  

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')

  const items = await db.item.findMany({
    where: { businessId, ...(search ? { name: { contains: search } } : {}) },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(items.map(i => ({
    id: i.id, sku: i.sku, name: i.name, nameAr: i.nameAr, description: i.description,
    unit: i.unit, category: i.category,
    salePrice: toNumber(i.salePrice), purchasePrice: toNumber(i.purchasePrice),
    costMethod: i.costMethod, stockQty: toNumber(i.stockQty),
    reorderLevel: toNumber(i.reorderLevel), taxRateId: i.taxRateId,
    isInventory: i.isInventory, isActive: i.isActive,
  })))
}

// POST
export async function POST(req: NextRequest) {
  const businessId = await ensureDefaultBusiness()
  

  const body = await req.json()
  const item = await db.item.create({
    data: {
      businessId,
      sku: body.sku,
      name: body.name,
      nameAr: body.nameAr || null,
      description: body.description || null,
      unit: body.unit || 'PCS',
      category: body.category || null,
      salePrice: body.salePrice || 0,
      purchasePrice: body.purchasePrice || 0,
      costMethod: body.costMethod || 'WEIGHTED_AVG',
      stockQty: body.stockQty || 0,
      reorderLevel: body.reorderLevel || 0,
      taxRateId: body.taxRateId || null,
      isInventory: body.isInventory !== false,
      isActive: body.isActive !== false,
    },
  })
  return NextResponse.json(item)
}

// PUT
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await req.json()
  const item = await db.item.update({
    where: { id },
    data: {
      sku: body.sku, name: body.name, nameAr: body.nameAr || null,
      description: body.description || null, unit: body.unit, category: body.category || null,
      salePrice: body.salePrice, purchasePrice: body.purchasePrice,
      stockQty: body.stockQty, reorderLevel: body.reorderLevel,
      taxRateId: body.taxRateId || null, isActive: body.isActive,
    },
  })
  return NextResponse.json(item)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.item.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
