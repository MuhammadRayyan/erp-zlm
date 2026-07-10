import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusinessId } from '@/lib/business-context'
import { calculateLine, calculateDocumentTotals } from '@/lib/vat-service'
import { postJournalEntry, reverseJournalEntry } from '@/lib/journal-service'
import { toNumber, money } from '@/lib/decimal'

// GET /api/credit-notes?id=xxx or list
export async function GET(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const cn = await db.creditNote.findUnique({
      where: { id },
      include: { party: true, lines: { include: { taxRate: true }, orderBy: { position: 'asc' } } },
    })
    if (!cn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...cn,
      subtotal: toNumber(cn.subtotal), totalTax: toNumber(cn.totalTax), total: toNumber(cn.total),
      lines: cn.lines.map(l => ({ ...l, quantity: toNumber(l.quantity), unitPrice: toNumber(l.unitPrice), lineTotal: toNumber(l.lineTotal) })),
    })
  }

  const cns = await db.creditNote.findMany({
    where: { businessId },
    include: { party: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(cns.map(c => ({ id: c.id, number: c.number, date: c.date, partyName: c.party.name, total: toNumber(c.total), status: c.status, reason: c.reason })))
}

// POST /api/credit-notes
export async function POST(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const body = await req.json()
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const lineInputs = body.lines.map((l: { quantity: number; unitPrice: number; discount: number; taxRate?: number }) => ({
    quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount,
    taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0),
  }))
  const totals = calculateDocumentTotals(lineInputs)
  const number = `${business.creditNotePrefix}${String(business.nextCreditNoteNumber).padStart(6, '0')}`

  let user = await db.user.findFirst()
  if (!user) user = await db.user.create({ data: { email: 'admin@local', name: 'Admin', role: 'ADMIN' } })

  const cn = await db.creditNote.create({
    data: {
      businessId, number,
      date: new Date(body.date),
      partyId: body.partyId,
      originalInvoiceId: body.originalInvoiceId || null,
      reference: body.reference || null,
      subtotal: totals.subtotal, totalTax: totals.totalTax, total: totals.total,
      status: body.post ? 'POSTED' : 'DRAFT',
      reason: body.reason || null,
      notes: body.notes || null,
      postedAt: body.post ? new Date() : null,
      lines: {
        create: body.lines.map((l: { description: string; quantity: number; unitPrice: number; discount: number; taxRateId?: string; taxRate?: number }, i: number) => {
          const calc = calculateLine({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, taxRate: l.taxRate ?? (business.vatRegistered ? Number(business.vatRate) : 0) })
          return { description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, position: i, taxRateId: l.taxRateId || null, lineTotal: calc.netAmount, lineTax: calc.taxAmount }
        }),
      },
    },
    include: { lines: true, party: true },
  })

  await db.business.update({ where: { id: businessId }, data: { nextCreditNoteNumber: { increment: 1 } } })

  // Post reversal journal entry
  if (body.post) {
    const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
    const salesAccount = await db.account.findFirst({ where: { businessId, subtype: 'SALES' } })
    const vatOutputAccount = await db.account.findFirst({ where: { businessId, code: '2220' } })

    if (arAccount && salesAccount) {
      // Credit note reverses: Credit AR, Debit Sales, Debit Output VAT
      await postJournalEntry({
        businessId, userId: user.id, date: new Date(body.date),
        reference: `Credit Note ${number}`, description: `Credit Note ${number} - ${cn.party.name}`,
        sourceType: 'CREDIT_NOTE', sourceId: cn.id,
        lines: [
          { accountId: salesAccount.id, debit: totals.subtotal, credit: 0, description: `CN reversal - ${number}` },
          ...(vatOutputAccount && totals.totalTax > 0 ? [{ accountId: vatOutputAccount.id, debit: totals.totalTax, credit: 0, description: `VAT reversal - ${number}` }] : []),
          { accountId: arAccount.id, debit: 0, credit: totals.total, partyId: body.partyId, description: `CN ${number}` },
        ],
      })
    }
  }

  return NextResponse.json(cn)
}
