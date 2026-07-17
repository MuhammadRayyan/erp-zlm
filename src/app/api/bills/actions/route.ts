import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession } from '@/lib/auth'
import { postJournalEntry, reverseJournalEntry } from '@/lib/journal-service'
import { money, toNumber } from '@/lib/decimal'

// POST /api/bills/actions — { action: 'post' | 'void', id }
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const { action, id } = body

  const bill = await db.purchaseBill.findFirst({ where: { id, businessId }, include: { party: true } })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }

  if (action === 'post') {
    if (bill.status !== 'DRAFT') return NextResponse.json({ error: 'Only draft bills can be posted' }, { status: 400 })

    const apAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_PAYABLE' } })
    const purchasesAccount = await db.account.findFirst({ where: { businessId, subtype: 'COST_OF_GOODS_SOLD' } })
    const vatInputAccount = await db.account.findFirst({ where: { businessId, code: '2210' } })

    if (apAccount && purchasesAccount) {
      const subtotal = toNumber(money(bill.subtotal))
      const tax = toNumber(money(bill.totalTax))
      const total = toNumber(money(bill.total))

      try {
        await postJournalEntry({
          businessId, userId: user.id, date: bill.date,
          reference: `Bill ${bill.number}`, description: `Purchase Bill ${bill.number} - ${bill.party.name}`,
          sourceType: 'PURCHASE_BILL', sourceId: bill.id,
          lines: [
            { accountId: purchasesAccount.id, debit: subtotal, credit: 0, description: `Purchase - ${bill.number}` },
            ...(vatInputAccount && tax > 0 ? [{ accountId: vatInputAccount.id, debit: tax, credit: 0, description: `Input VAT - ${bill.number}` }] : []),
            { accountId: apAccount.id, debit: 0, credit: total, partyId: bill.partyId, description: `Bill ${bill.number}` },
          ],
        })

        const updated = await db.purchaseBill.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } })
        return NextResponse.json(updated)
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to post journal entry' }, { status: 400 })
      }
    }

    const updated = await db.purchaseBill.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } })
    return NextResponse.json(updated)
  }

  if (action === 'void') {
    if (bill.status === 'DRAFT') {
      const updated = await db.purchaseBill.update({ where: { id }, data: { status: 'VOID' } })
      return NextResponse.json(updated)
    }
    const je = await db.journalEntry.findFirst({ where: { sourceType: 'PURCHASE_BILL', sourceId: id } })
    if (je) await reverseJournalEntry(je.id, user.id, `Void of bill ${bill.number}`)
    const updated = await db.purchaseBill.update({ where: { id }, data: { status: 'VOID' } })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
