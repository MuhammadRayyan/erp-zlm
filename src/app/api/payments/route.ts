import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession } from '@/lib/auth'
import { postJournalEntry } from '@/lib/journal-service'
import { toNumber, money } from '@/lib/decimal'
import { paymentSchema, validateBody } from '@/lib/validation-schemas'

// GET /api/payments?type=RECEIPT|PAYMENT
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100)

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
  
  // Validate input
  const validation = validateBody(paymentSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', fieldErrors: validation.errors }, { status: 400 })
  }
  
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const isReceipt = body.type === 'RECEIPT'
  const prefix = isReceipt ? business.receiptPrefix : business.paymentPrefix
  const nextNum = isReceipt ? business.nextReceiptNumber : business.nextPaymentNumber
  const number = `${prefix}${String(nextNum).padStart(6, '0')}`

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const user = { id: session.userId, name: session.name, email: session.email }

const amount = toNumber(money(body.amount))

  // Guard against over-allocation
  if (body.allocations && body.allocations.length > 0) {
    const totalAllocated = body.allocations.reduce((s: number, a: { amount: number }) => s + a.amount, 0)
    if (totalAllocated > amount) {
      return NextResponse.json({ error: `Allocated amount (${totalAllocated}) exceeds payment amount (${amount})` }, { status: 400 })
    }
    // Check each allocation doesn't exceed the invoice/bill balance
    for (const alloc of body.allocations) {
      if (alloc.invoiceId) {
        const inv = await db.salesInvoice.findFirst({ where: { id: alloc.invoiceId, businessId } })
        if (inv) {
          const balance = Number(inv.total) - Number(inv.amountPaid)
          if (alloc.amount > balance) {
            return NextResponse.json({ error: `Allocation (${alloc.amount}) exceeds invoice balance (${balance}) for ${inv.number}` }, { status: 400 })
          }
        }
      }
      if (alloc.billId) {
        const bill = await db.purchaseBill.findFirst({ where: { id: alloc.billId, businessId } })
        if (bill) {
          const balance = Number(bill.total) - Number(bill.amountPaid)
          if (alloc.amount > balance) {
            return NextResponse.json({ error: `Allocation (${alloc.amount}) exceeds bill balance (${balance}) for ${bill.number}` }, { status: 400 })
          }
        }
      }
    }
  }

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
      const inv = await db.salesInvoice.findFirst({ where: { id: alloc.invoiceId, businessId } })
      if (inv) {
        const newPaid = toNumber(money(inv.amountPaid).plus(money(alloc.amount)))
        const newStatus = newPaid >= toNumber(money(inv.total)) ? 'PAID' : 'PARTIALLY_PAID'
        await db.salesInvoice.update({ where: { id: inv.id }, data: { amountPaid: newPaid, status: newStatus } })
      }
    }
    if (alloc.billId) {
      const bill = await db.purchaseBill.findFirst({ where: { id: alloc.billId, businessId } })
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
  const cashAccount = await db.account.findFirst({ where: { businessId, subtype: 'CASH' } })
  const bankGlAccount = await db.account.findFirst({ where: { businessId, subtype: 'BANK' } })

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
