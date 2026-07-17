import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession } from '@/lib/auth'
import { postJournalEntry, reverseJournalEntry } from '@/lib/journal-service'
import { money, toNumber } from '@/lib/decimal'
import { generateEInvoiceUuid } from '@/lib/vat-service'

// POST /api/invoices/actions — { action: 'post' | 'void', id }
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const { action, id } = body

  const invoice = await db.salesInvoice.findFirst({
    where: { id, businessId },
    include: { party: true, lines: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }

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

      try {
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

        const updated = await db.salesInvoice.update({
          where: { id },
          data: {
            status: 'POSTED',
            postedAt: new Date(),
            einvoiceUuid: generateEInvoiceUuid(),
          },
        })
        return NextResponse.json(updated)
      } catch (err: any) {
        console.error('Failed to post journal entry:', err)
        return NextResponse.json({ error: err.message || 'Failed to post journal entry' }, { status: 400 })
      }
    }
  }

  if (action === 'void') {
    if (invoice.status === 'DRAFT') {
      return NextResponse.json({ error: 'Draft invoices can be deleted instead of voided' }, { status: 400 })
      const updated = await db.salesInvoice.update({ where: { id }, data: { status: 'VOID' } })
      return NextResponse.json(updated)
    }

    // Reverse the journal entry
    // Reverse ALL related journal entries (not just the first)
    const journalEntries = await db.journalEntry.findMany({ where: { sourceType: 'SALES_INVOICE', sourceId: id } })
    for (const je of journalEntries) {
      await reverseJournalEntry(je.id, user.id, `Void of invoice ${invoice.number}`)
    }

    const updated = await db.salesInvoice.update({ where: { id }, data: { status: 'VOID' } })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
