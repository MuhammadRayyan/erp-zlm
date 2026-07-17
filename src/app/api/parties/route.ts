import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, AuthError } from '@/lib/auth'
import { toNumber } from '@/lib/decimal'

// GET /api/parties?type=CUSTOMER|SUPPLIER
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  const where: { businessId: string; type?: { in: string[] }; name?: { contains: string } } = { businessId }
  if (type === 'CUSTOMER') where.type = { in: ['CUSTOMER', 'BOTH'] }
  if (type === 'SUPPLIER') where.type = { in: ['SUPPLIER', 'BOTH'] }
  if (search) where.name = { contains: search }

  const parties = await db.party.findMany({
    where,
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(parties.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    nameAr: p.nameAr,
    type: p.type,
    trn: p.trn,
    email: p.email,
    phone: p.phone,
    contactPerson: p.contactPerson,
    city: p.billingCity,
    state: p.billingState,
    country: p.billingCountry,
    paymentTerms: p.paymentTerms,
    creditLimit: toNumber(p.creditLimit),
    openingBalance: toNumber(p.openingBalance),
    openingBalanceType: p.openingBalanceType,
    notes: p.notes,
    isActive: p.isActive,
    billingAddress1: p.billingAddress1,
    billingAddress2: p.billingAddress2,
    billingCity: p.billingCity,
    billingState: p.billingState,
    billingPostalCode: p.billingPostalCode,
    billingCountry: p.billingCountry,
    shippingAddress1: p.shippingAddress1,
    shippingAddress2: p.shippingAddress2,
    shippingCity: p.shippingCity,
    shippingState: p.shippingState,
    shippingPostalCode: p.shippingPostalCode,
    shippingCountry: p.shippingCountry,
    website: p.website,
  })))
}

// POST /api/parties
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const party = await db.party.create({
    data: {
      businessId,
      code: body.code || null,
      name: body.name,
      nameAr: body.nameAr || null,
      type: body.type || 'CUSTOMER',
      trn: body.trn || null,
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      contactPerson: body.contactPerson || null,
      billingAddress1: body.billingAddress1 || null,
      billingAddress2: body.billingAddress2 || null,
      billingCity: body.billingCity || null,
      billingState: body.billingState || null,
      billingPostalCode: body.billingPostalCode || null,
      billingCountry: body.billingCountry || 'AE',
      shippingAddress1: body.shippingAddress1 || null,
      shippingAddress2: body.shippingAddress2 || null,
      shippingCity: body.shippingCity || null,
      shippingState: body.shippingState || null,
      shippingPostalCode: body.shippingPostalCode || null,
      shippingCountry: body.shippingCountry || 'AE',
      paymentTerms: body.paymentTerms || 30,
      creditLimit: body.creditLimit || 0,
      openingBalance: body.openingBalance || 0,
      openingBalanceType: body.openingBalanceType || 'DEBIT',
      notes: body.notes || null,
      isActive: body.isActive !== false,
    },
  })
  return NextResponse.json(party)
}

// PUT /api/parties?id=xxx
export async function PUT(req: NextRequest) {
  let businessId: string
  try { businessId = await ensureBusinessId() } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // SECURITY: Verify party belongs to current business
  const existing = await db.party.findFirst({ where: { id, businessId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const party = await db.party.update({
    where: { id },
    data: {
      code: body.code || null,
      name: body.name,
      nameAr: body.nameAr || null,
      type: body.type,
      trn: body.trn || null,
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      contactPerson: body.contactPerson || null,
      billingAddress1: body.billingAddress1 || null,
      billingAddress2: body.billingAddress2 || null,
      billingCity: body.billingCity || null,
      billingState: body.billingState || null,
      billingPostalCode: body.billingPostalCode || null,
      billingCountry: body.billingCountry || 'AE',
      shippingAddress1: body.shippingAddress1 || null,
      shippingAddress2: body.shippingAddress2 || null,
      shippingCity: body.shippingCity || null,
      shippingState: body.shippingState || null,
      shippingPostalCode: body.shippingPostalCode || null,
      shippingCountry: body.shippingCountry || 'AE',
      paymentTerms: body.paymentTerms || 30,
      creditLimit: body.creditLimit || 0,
      openingBalance: body.openingBalance || 0,
      openingBalanceType: body.openingBalanceType || 'DEBIT',
      notes: body.notes || null,
      isActive: body.isActive,
    },
  })
  return NextResponse.json(party)
}

// DELETE /api/parties?id=xxx
export async function DELETE(req: NextRequest) {
  let businessId: string
  try { businessId = await ensureBusinessId() } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // SECURITY: Verify party belongs to current business
  const existing = await db.party.findFirst({ where: { id, businessId } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await db.party.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Cannot delete party with existing transactions. Consider deactivating instead.' }, { status: 400 })
  }
}
