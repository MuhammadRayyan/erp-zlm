import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId } from '@/lib/auth'
import { calculateLine, calculateDocumentTotals } from '@/lib/vat-service'
import { quotationSchema, validateBody } from '@/lib/validation-schemas'
import { toNumber, money } from '@/lib/decimal'

// GET /api/quotations?id=xxx or list
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    // SECURITY: Verify quotation belongs to current business (tenant isolation)
    const q = await db.quotation.findFirst({
      where: { id, businessId },
      include: { party: true, lines: { include: { taxRate: true }, orderBy: { position: 'asc' } } },
    })
    if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...q,
      subtotal: toNumber(q.subtotal),
      totalTax: toNumber(q.totalTax),
      total: toNumber(q.total),
      lines: q.lines.map(l => ({ ...l, quantity: toNumber(l.quantity), unitPrice: toNumber(l.unitPrice), lineTotal: toNumber(l.lineTotal) })),
    })
  }

  const quotations = await db.quotation.findMany({
    where: { businessId },
    include: { party: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(quotations.map(q => ({
    id: q.id, number: q.number, date: q.date, validUntil: q.validUntil,
    partyName: q.party.name, total: toNumber(q.total), status: q.status,
  })))
}

// POST /api/quotations
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  
  // Validate input
  const validation = validateBody(quotationSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: validation.errors }, { status: 400 })
  }
  
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const lineInputs = body.lines.map((l: { quantity: number; unitPrice: number; discount: number; taxRate?: number }) => ({
    quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount,
    taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0),
  }))
  const totals = calculateDocumentTotals(lineInputs)
  const number = `${business.quotationPrefix}${String(business.nextQuotationNumber).padStart(6, '0')}`

  const quotation = await db.quotation.create({
    data: {
      businessId, number,
      date: new Date(body.date),
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      partyId: body.partyId,
      reference: body.reference || null,
      subtotal: totals.subtotal, totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax, total: totals.total,
      status: 'DRAFT',
      notes: body.notes || null, terms: body.terms || null,
      lines: {
        create: body.lines.map((l: { description: string; quantity: number; unitPrice: number; discount: number; taxRateId?: string; taxRate?: number }, i: number) => {
          const calc = calculateLine({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0) })
          return { description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, position: i, taxRateId: l.taxRateId || null, lineTotal: calc.netAmount, lineTax: calc.taxAmount }
        }),
      },
    },
    include: { lines: true },
  })

  await db.business.update({ where: { id: businessId }, data: { nextQuotationNumber: { increment: 1 } } })
  return NextResponse.json(quotation)
}

// PUT /api/quotations?id=xxx — update (only if DRAFT)
export async function PUT(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const quotation = await db.quotation.findFirst({ where: { id, businessId } })
  if (!quotation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (quotation.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only draft quotations can be edited' }, { status: 400 })
  }

  const body = await req.json()
  
  // Validate input
  const validation = validateBody(quotationSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: validation.errors }, { status: 400 })
  }
  
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const lineInputs = body.lines.map((l: { quantity: number; unitPrice: number; discount: number; taxRate?: number }) => ({
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount,
    taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0),
  }))
  const totals = calculateDocumentTotals(lineInputs)

  // Delete old lines, create new
  await db.quotationLine.deleteMany({ where: { quotationId: id } })

  const updated = await db.quotation.update({
    where: { id },
    data: {
      date: new Date(body.date),
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      partyId: body.partyId,
      reference: body.reference || null,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      total: totals.total,
      notes: body.notes || null,
      terms: body.terms || null,
      lines: {
        create: body.lines.map((l: { description: string; quantity: number; unitPrice: number; discount: number; taxRateId?: string; taxRate?: number }, i: number) => {
          const calc = calculateLine({
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0),
          })
          return {
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            position: i,
            taxRateId: l.taxRateId || null,
            lineTotal: calc.netAmount,
            lineTax: calc.taxAmount,
          }
        }),
      },
    },
    include: { lines: true },
  })

  return NextResponse.json(updated)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.quotation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
