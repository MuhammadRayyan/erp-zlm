import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusinessId } from '@/lib/business-context'
import { postJournalEntry, reverseJournalEntry } from '@/lib/journal-service'
import { money, toNumber } from '@/lib/decimal'
import { generateEInvoiceUuid } from '@/lib/vat-service'

// POST /api/invoices/actions — { action: 'post' | 'void', id }
export async function POST(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const body = await req.json()
  const { action, id } = body

  const invoice = await db.salesInvoice.findUnique({
    where: { id },
    include: { party: true, lines: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  let user = await db.user.findFirst()
  if (!user) {
    user = await db.user.create({ data: { email: 'admin@local', name: 'Admin', role: 'ADMIN' } })
  }

  if (action === 'post') {
    if (invoice.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only draft invoices can be posted' }, { status: 400 })
    }

    const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
    const salesAccount = await db.account.findFirst({ where: { businessId, subtype: 'SALES' } })
    const vatOutputAccount = await db.account.findFirst({ where: { businessId, code: '2220' } })

    if (arAccount && salesAccount) {
      const total = toNumber(money(invoice.total))
      const subtotal = toNumber(money(invoice.subtotal))
      const tax = toNumber(money(invoice.totalTax))

      await postJournalEntry({
        businessId,
        userId: user.id,
        date: invoice.date,
        reference: `Invoice ${invoice.number}`,
        description: `Sales Invoice ${invoice.number} - ${invoice.party.name}`,
        sourceType: 'SALES_INVOICE',
        sourceId: invoice.id,
        lines: [
          { accountId: arAccount.id, debit: total, credit: 0, partyId: invoice.partyId, description: `Invoice ${invoice.number}` },
          { accountId: salesAccount.id, debit: 0, credit: subtotal, description: `Sales - ${invoice.number}` },
          ...(vatOutputAccount && tax > 0 ? [{ accountId: vatOutputAccount.id, debit: 0, credit: tax, description: `Output VAT - ${invoice.number}` }] : []),
        ],
      })
    }

    const updated = await db.salesInvoice.update({
      where: { id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
        einvoiceUuid: generateEInvoiceUuid(),
      },
    })
    return NextResponse.json(updated)
  }

  if (action === 'void') {
    if (invoice.status === 'DRAFT') {
      const updated = await db.salesInvoice.update({ where: { id }, data: { status: 'VOID' } })
      return NextResponse.json(updated)
    }

    // Reverse the journal entry
    const je = await db.journalEntry.findFirst({ where: { sourceType: 'SALES_INVOICE', sourceId: id } })
    if (je) {
      await reverseJournalEntry(je.id, user.id, `Void of invoice ${invoice.number}`)
    }

    const updated = await db.salesInvoice.update({ where: { id }, data: { status: 'VOID' } })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
