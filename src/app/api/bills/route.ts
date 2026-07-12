import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession , AuthError } from '@/lib/auth'
import { postJournalEntry, reverseJournalEntry } from '@/lib/journal-service'
import { calculateLine, calculateDocumentTotals } from '@/lib/vat-service'
import { toNumber, money } from '@/lib/decimal'

// GET /api/bills?id=xxx or list
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const limit = parseInt(searchParams.get('limit') || '50')

  if (id) {
    const bill = await db.purchaseBill.findUnique({
      where: { id },
      include: { party: true, lines: { include: { taxRate: true }, orderBy: { position: 'asc' } } },
    })
    if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...bill,
      subtotal: toNumber(bill.subtotal),
      totalDiscount: toNumber(bill.totalDiscount),
      totalTax: toNumber(bill.totalTax),
      total: toNumber(bill.total),
      amountPaid: toNumber(bill.amountPaid),
      balanceDue: toNumber(money(bill.total).minus(money(bill.amountPaid))),
      lines: bill.lines.map(l => ({
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

  const bills = await db.purchaseBill.findMany({
    where: { businessId },
    include: { party: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return NextResponse.json(bills.map(b => ({
    id: b.id,
    number: b.number,
    date: b.date,
    dueDate: b.dueDate,
    partyName: b.party.name,
    supplierInvoiceNumber: b.supplierInvoiceNumber,
    subtotal: toNumber(b.subtotal),
    totalTax: toNumber(b.totalTax),
    total: toNumber(b.total),
    amountPaid: toNumber(b.amountPaid),
    balanceDue: toNumber(money(b.total).minus(money(b.amountPaid))),
    status: b.status,
    currency: b.currency,
  })))
}

// POST /api/bills
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const lineInputs = body.lines.map((l: { quantity: number; unitPrice: number; discount: number; taxRate?: number }) => ({
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    discount: l.discount,
    taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0),
  }))
  const totals = calculateDocumentTotals(lineInputs)
  const number = `${business.billPrefix}${String(business.nextBillNumber).padStart(6, '0')}`

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }

  const bill = await db.purchaseBill.create({
    data: {
      businessId,
      number,
      date: new Date(body.date),
      dueDate: new Date(body.dueDate || body.date),
      partyId: body.partyId,
      supplierInvoiceNumber: body.supplierInvoiceNumber || null,
      reference: body.reference || null,
      currency: body.currency || business.baseCurrency,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      total: totals.total,
      amountPaid: 0,
      status: body.post ? 'POSTED' : 'DRAFT',
      notes: body.notes || null,
      postedAt: body.post ? new Date() : null,
      createdById: user.id,
      lines: {
        create: body.lines.map((l: { description: string; quantity: number; unitPrice: number; discount: number; taxRateId?: string; taxRate?: number }, i: number) => {
          const calc = calculateLine({
            quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount,
            taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0),
          })
          return {
            description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
            discount: l.discount, position: i, taxRateId: l.taxRateId || null,
            lineTotal: calc.netAmount, lineTax: calc.taxAmount,
          }
        }),
      },
    },
    include: { lines: true, party: true },
  })

  await db.business.update({ where: { id: businessId }, data: { nextBillNumber: { increment: 1 } } })

  if (body.post) {
    const apAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_PAYABLE' } })
    const purchasesAccount = await db.account.findFirst({ where: { businessId, subtype: 'COST_OF_GOODS_SOLD' } })
    const vatInputAccount = await db.account.findFirst({ where: { businessId, code: '2210' } })

    if (apAccount && purchasesAccount) {
      await postJournalEntry({
        businessId, userId: user.id, date: new Date(body.date),
        reference: `Bill ${number}`, description: `Purchase Bill ${number} - ${bill.party.name}`,
        sourceType: 'PURCHASE_BILL', sourceId: bill.id,
        lines: [
          { accountId: purchasesAccount.id, debit: totals.subtotal, credit: 0, description: `Purchase - ${number}` },
          ...(vatInputAccount && totals.totalTax > 0 ? [{ accountId: vatInputAccount.id, debit: totals.totalTax, credit: 0, description: `Input VAT - ${number}` }] : []),
          { accountId: apAccount.id, debit: 0, credit: totals.total, partyId: body.partyId, description: `Bill ${number}` },
        ],
      })
    }
  }

  return NextResponse.json(bill)
}

// DELETE /api/bills?id=xxx (only if DRAFT)
export async function DELETE(req: NextRequest) {
  let businessId: string
  try { businessId = await ensureBusinessId() } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const bill = await db.purchaseBill.findFirst({ where: { id, businessId } })
  if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (bill.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only draft bills can be deleted' }, { status: 400 })
  }

  await db.purchaseBill.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
