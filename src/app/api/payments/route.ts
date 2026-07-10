import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession } from '@/lib/auth'
import { postJournalEntry } from '@/lib/journal-service'
import { toNumber, money } from '@/lib/decimal'

// GET /api/payments?type=RECEIPT|PAYMENT
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '50')

  const payments = await db.payment.findMany({
    where: { businessId, ...(type ? { type } : {}) },
    include: { party: { select: { name: true } } },
    orderBy: { date: 'desc' },
    take: limit,
  })

  return NextResponse.json(payments.map(p => ({
    id: p.id,
    number: p.number,
    date: p.date,
    type: p.type,
    partyName: p.party.name,
    amount: toNumber(p.amount),
    method: p.method,
    reference: p.reference,
    description: p.description,
    status: p.status,
    currency: p.currency,
  })))
}

// POST /api/payments — create payment + allocate to invoices/bills + post journal
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const isReceipt = body.type === 'RECEIPT'
  const prefix = isReceipt ? business.receiptPrefix : business.paymentPrefix
  const nextNum = isReceipt ? business.nextReceiptNumber : business.nextPaymentNumber
  const number = `${prefix}${String(nextNum).padStart(6, '0')}`

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }
  if (!user) user = await db.user.create({ data: { email: 'admin@local', name: 'Admin', role: 'ADMIN' } })

  const amount = toNumber(money(body.amount))

  // Create payment
  const payment = await db.payment.create({
    data: {
      businessId,
      number,
      date: new Date(body.date),
      type: body.type,
      partyId: body.partyId,
      amount,
      currency: body.currency || business.baseCurrency,
      method: body.method || 'CASH',
      reference: body.reference || null,
      bankAccountId: body.bankAccountId || null,
      description: body.description || null,
      status: 'POSTED',
      createdById: user.id,
      allocations: {
        create: (body.allocations || []).map((a: { invoiceId?: string; billId?: string; amount: number }) => ({
          invoiceId: a.invoiceId || null,
          billId: a.billId || null,
          amount: a.amount,
        })),
      },
    },
    include: { allocations: true },
  })

  // Update invoice/bill amounts paid
  for (const alloc of payment.allocations) {
    if (alloc.invoiceId) {
      const inv = await db.salesInvoice.findUnique({ where: { id: alloc.invoiceId } })
      if (inv) {
        const newPaid = toNumber(money(inv.amountPaid).plus(money(alloc.amount)))
        const newStatus = newPaid >= toNumber(money(inv.total)) ? 'PAID' : 'PARTIALLY_PAID'
        await db.salesInvoice.update({ where: { id: inv.id }, data: { amountPaid: newPaid, status: newStatus } })
      }
    }
    if (alloc.billId) {
      const bill = await db.purchaseBill.findUnique({ where: { id: alloc.billId } })
      if (bill) {
        const newPaid = toNumber(money(bill.amountPaid).plus(money(alloc.amount)))
        const newStatus = newPaid >= toNumber(money(bill.total)) ? 'PAID' : 'PARTIALLY_PAID'
        await db.purchaseBill.update({ where: { id: bill.id }, data: { amountPaid: newPaid, status: newStatus } })
      }
    }
  }

  // Increment number
  if (isReceipt) {
    await db.business.update({ where: { id: businessId }, data: { nextReceiptNumber: { increment: 1 } } })
  } else {
    await db.business.update({ where: { id: businessId }, data: { nextPaymentNumber: { increment: 1 } } })
  }

  // Post journal entry
  // Receipt: Debit Bank/Cash, Credit AR
  // Payment: Debit AP, Credit Bank/Cash
  const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
  const apAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_PAYABLE' } })
  let bankAccount: { accountId: string | null } | null = null
  if (body.bankAccountId) {
    bankAccount = await db.bankAccount.findUnique({ where: { id: body.bankAccountId }, select: { accountId: true } })
  }
  const cashAccount = await db.account.findFirst({ where: { businessId, subtype: 'CASH' } })
  const bankGlAccount = bankAccount?.accountId
    ? await db.account.findUnique({ where: { id: bankAccount.accountId } })
    : await db.account.findFirst({ where: { businessId, subtype: 'BANK' } })

  const cashOrBank = bankGlAccount || cashAccount
  if (!cashOrBank) return NextResponse.json(payment)

  if (isReceipt && arAccount) {
    await postJournalEntry({
      businessId, userId: user.id, date: new Date(body.date),
      reference: `Receipt ${number}`, description: `Receipt from ${body.partyName || ''}`,
      sourceType: 'PAYMENT', sourceId: payment.id,
      lines: [
        { accountId: cashOrBank.id, debit: amount, credit: 0, description: `Receipt ${number}` },
        { accountId: arAccount.id, debit: 0, credit: amount, partyId: body.partyId, description: `Receipt ${number}` },
      ],
    })
  } else if (!isReceipt && apAccount) {
    await postJournalEntry({
      businessId, userId: user.id, date: new Date(body.date),
      reference: `Payment ${number}`, description: `Payment to ${body.partyName || ''}`,
      sourceType: 'PAYMENT', sourceId: payment.id,
      lines: [
        { accountId: apAccount.id, debit: amount, credit: 0, partyId: body.partyId, description: `Payment ${number}` },
        { accountId: cashOrBank.id, debit: 0, credit: amount, description: `Payment ${number}` },
      ],
    })
  }

  return NextResponse.json(payment)
}
