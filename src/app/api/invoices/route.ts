import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession , AuthError } from '@/lib/auth'
import { postJournalEntry } from '@/lib/journal-service'
import { calculateLine, calculateDocumentTotals, generateEInvoiceUuid } from '@/lib/vat-service'
import { invoiceSchema, validateBody } from '@/lib/validation-schemas'
import { toNumber, money } from '@/lib/decimal'

// GET /api/invoices?id=xxx (single) or list
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const status = searchParams.get('status')
  const partyId = searchParams.get('partyId')
  const search = searchParams.get('search')
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100)

  if (id) {
    // SECURITY: Verify invoice belongs to current business (tenant isolation)
    const invoice = await db.salesInvoice.findFirst({
      where: { id, businessId },
      include: {
        party: true,
        lines: { include: { taxRate: true }, orderBy: { position: 'asc' } },
      },
    })
    if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...invoice,
      subtotal: toNumber(invoice.subtotal),
      totalDiscount: toNumber(invoice.totalDiscount),
      totalTax: toNumber(invoice.totalTax),
      total: toNumber(invoice.total),
      amountPaid: toNumber(invoice.amountPaid),
      balanceDue: toNumber(money(invoice.total).minus(money(invoice.amountPaid))),
      lines: invoice.lines.map(l => ({
        ...l,
        quantity: toNumber(l.quantity),
        unitPrice: toNumber(l.unitPrice),
        discount: toNumber(l.discount),
        lineTotal: toNumber(l.lineTotal),
        lineTax: toNumber(l.lineTax),
        taxRate: l.taxRate ? { ...l.taxRate, rate: toNumber(l.taxRate.rate) } : null,
      })),
    })
  }

  const where: any = { businessId }
  if (status && status !== 'ALL') where.status = status
  if (partyId) where.partyId = partyId
  if (search) {
    where.OR = [
      { number: { contains: search } },
      { reference: { contains: search } },
      { party: { name: { contains: search } } },
    ]
  }

  const invoices = await db.salesInvoice.findMany({
    where,
    include: { party: { select: { name: true } } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  
  const hasMore = invoices.length > limit
  const items = hasMore ? invoices.slice(0, -1) : invoices
  const nextCursor = hasMore ? items[items.length - 1]?.id : null

  return NextResponse.json({
    items: items.map(inv => ({
    id: inv.id,
    number: inv.number,
    date: inv.date,
    dueDate: inv.dueDate,
    partyName: inv.party.name,
    partyId: inv.partyId,
    reference: inv.reference,
    subtotal: toNumber(inv.subtotal),
    totalTax: toNumber(inv.totalTax),
    total: toNumber(inv.total),
    amountPaid: toNumber(inv.amountPaid),
    balanceDue: toNumber(money(inv.total).minus(money(inv.amountPaid))),
    status: inv.status,
    currency: inv.currency,
  })),
    nextCursor,
    hasMore,
  })
}

// POST /api/invoices — create (and optionally post) invoice
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  
  // Validate input with Zod
  const validation = validateBody(invoiceSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: validation.errors }, { status: 400 })
  }
  
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  // Calculate totals from lines
  const lineInputs = body.lines.map((l: { quantity: number; unitPrice: number; discount: number; taxRate?: number; taxRateId?: string }) => {
    const taxRate = l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0)
    return {
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: l.discount,
      taxRate,
      taxCategory: 'STANDARD_RATED',
    }
  })
  const totals = calculateDocumentTotals(lineInputs)

  // Generate invoice number
  const number = `${business.invoicePrefix}${String(business.nextInvoiceNumber).padStart(6, '0')}`

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }

  // Create invoice
  const invoice = await db.salesInvoice.create({
    data: {
      businessId,
      number,
      date: new Date(body.date),
      dueDate: new Date(body.dueDate || body.date),
      partyId: body.partyId,
      reference: body.reference || null,
      currency: body.currency || business.baseCurrency,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      total: totals.total,
      amountPaid: 0,
      status: body.post ? 'POSTED' : 'DRAFT',
      notes: body.notes || null,
      terms: body.terms || null,
      einvoiceUuid: body.post ? generateEInvoiceUuid() : null,
      postedAt: body.post ? new Date() : null,
      createdById: user.id,
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
    include: { lines: true, party: true },
  })

  // Increment invoice number
  await db.business.update({
    where: { id: businessId },
    data: { nextInvoiceNumber: { increment: 1 } },
  })

  // If posting, create journal entry
  if (body.post) {
    // Find AR control account and Sales account and VAT account
    const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
    const salesAccount = await db.account.findFirst({ where: { businessId, subtype: 'SALES' } })
    const vatOutputAccount = await db.account.findFirst({ where: { businessId, code: '2220' } }) // Output VAT

    if (arAccount && salesAccount) {
      await postJournalEntry({
        businessId,
        userId: user.id,
        date: new Date(body.date),
        reference: `Invoice ${number}`,
        description: `Sales Invoice ${number} - ${invoice.party.name}`,
        sourceType: 'SALES_INVOICE',
        sourceId: invoice.id,
        lines: [
          // Debit AR for total
          { accountId: arAccount.id, debit: totals.total, credit: 0, partyId: body.partyId, description: `Invoice ${number}` },
          // Credit Sales for subtotal
          { accountId: salesAccount.id, debit: 0, credit: totals.subtotal, description: `Sales - ${number}` },
          // Credit Output VAT for tax
          ...(vatOutputAccount && totals.totalTax > 0 ? [{ accountId: vatOutputAccount.id, debit: 0, credit: totals.totalTax, description: `Output VAT - ${number}` }] : []),
        ],
      })
    }
  }

  return NextResponse.json(invoice)
}

// PUT /api/invoices?id=xxx — update (only if DRAFT)
export async function PUT(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const invoice = await db.salesInvoice.findFirst({ where: { id, businessId } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (invoice.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only draft invoices can be edited' }, { status: 400 })
  }

  const body = await req.json()
  
  // Validate input with Zod
  const validation = validateBody(invoiceSchema, body)
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
  await db.salesInvoiceLine.deleteMany({ where: { invoiceId: id } })

  const updated = await db.salesInvoice.update({
    where: { id },
    data: {
      date: new Date(body.date),
      dueDate: new Date(body.dueDate || body.date),
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

// DELETE /api/invoices?id=xxx (only if DRAFT)
export async function DELETE(req: NextRequest) {
  let businessId: string
  try { businessId = await ensureBusinessId() } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const invoice = await db.salesInvoice.findFirst({ where: { id, businessId } })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (invoice.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 400 })
  }

  await db.salesInvoice.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
