import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getSession } from '@/lib/auth'
import { postJournalEntry, reverseJournalEntry } from '@/lib/journal-service'
import { toNumber, money } from '@/lib/decimal'
import { generateEInvoiceUuid } from '@/lib/vat-service'

export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }

  const body = await req.json()
  const { action, id } = body

  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const cn = await db.creditNote.findFirst({
    where: { id, businessId },
    include: { party: true, lines: true },
  })

  if (!cn) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'post') {
    if (cn.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only draft credit notes can be posted' }, { status: 400 })
    }

    const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
    const salesAccount = await db.account.findFirst({ where: { businessId, subtype: 'SALES' } })
    const vatOutputAccount = await db.account.findFirst({ where: { businessId, code: '2220' } })

    if (arAccount && salesAccount) {
      const subtotal = toNumber(money(cn.subtotal))
      const tax = toNumber(money(cn.totalTax))
      const total = toNumber(money(cn.total))

      try {
        await postJournalEntry({
          businessId,
          userId: user.id,
          date: cn.date,
          reference: `Credit Note ${cn.number}`,
          description: `Credit Note ${cn.number} - ${cn.party.name}`,
          sourceType: 'CREDIT_NOTE',
          sourceId: cn.id,
          lines: [
            { accountId: salesAccount.id, debit: subtotal, credit: 0, description: `CN reversal - ${cn.number}` },
            ...(vatOutputAccount && tax > 0 ? [{ accountId: vatOutputAccount.id, debit: tax, credit: 0, description: `VAT reversal - ${cn.number}` }] : []),
            { accountId: arAccount.id, debit: 0, credit: total, partyId: cn.partyId, description: `CN ${cn.number}` },
          ],
        })

        const updated = await db.creditNote.update({
          where: { id },
          data: {
            status: 'POSTED',
            postedAt: new Date(),
          },
        })
        return NextResponse.json(updated)
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to post journal entry' }, { status: 400 })
      }
    }

    const updated = await db.creditNote.update({
      where: { id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
      },
    })
    return NextResponse.json(updated)
  }

  if (action === 'void') {
    if (cn.status === 'DRAFT') {
      const updated = await db.creditNote.update({
        where: { id },
        data: { status: 'VOID' },
      })
      return NextResponse.json(updated)
    }

    // Only allow voiding if it's posted
    if (cn.status !== 'POSTED') {
      return NextResponse.json({ error: 'Cannot void this credit note' }, { status: 400 })
    }

    const je = await db.journalEntry.findFirst({
      where: { sourceType: 'CREDIT_NOTE', sourceId: id }
    })
    
    if (je) {
      await reverseJournalEntry(je.id, user.id, `Void of credit note ${cn.number}`)
    }

    const updated = await db.creditNote.update({
      where: { id },
      data: { status: 'VOID' },
    })

    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
