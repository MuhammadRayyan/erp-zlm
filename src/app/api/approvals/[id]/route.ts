import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, hasPermission, AuthError } from '@/lib/auth'
import { postJournalEntry } from '@/lib/journal-service'
import { money, toNumber } from '@/lib/decimal'
import { generateEInvoiceUuid } from '@/lib/vat-service'
import { logActivity, logAudit, getClientIp } from '@/lib/activity-logger'

// ============================================================
// APPROVALS [id] — approve or reject a pending document
// ============================================================
//
// POST /api/approvals/[id] — Body: { action: 'approve' | 'reject', reason?: string, type: 'SALES_INVOICE' | 'PURCHASE_BILL' | 'PAYMENT' }
//
// Only TENANT_ADMIN can approve / reject. Approving a document sets
// approvalStatus='APPROVED', creates the posting journal entry (mirrors
// the logic in /api/invoices, /api/bills, /api/payments) and sets the
// document's `status` to 'POSTED'. Rejecting sets approvalStatus='REJECTED'
// and leaves the document unposted.
// ============================================================

type ApprovalType = 'SALES_INVOICE' | 'PURCHASE_BILL' | 'PAYMENT'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json(
      { error: 'Only tenant administrators can approve or reject documents' },
      { status: 403 },
    )
  }

  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const action = (body.action || '').toString().toLowerCase()
  const type = (body.type || '').toString() as ApprovalType
  const reason = (body.reason || '').toString().trim()

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 })
  }
  if (type !== 'SALES_INVOICE' && type !== 'PURCHASE_BILL' && type !== 'PAYMENT') {
    return NextResponse.json({ error: 'Type must be SALES_INVOICE, PURCHASE_BILL, or PAYMENT' }, { status: 400 })
  }

  const tenantId = await getCurrentTenantId()
  const userId = session.userId

  try {
    if (type === 'SALES_INVOICE') {
      return await handleInvoiceApproval(req, id, businessId, action, reason, userId, tenantId)
    }
    if (type === 'PURCHASE_BILL') {
      return await handleBillApproval(req, id, businessId, action, reason, userId, tenantId)
    }
    return await handlePaymentApproval(req, id, businessId, action, reason, userId, tenantId)
  } catch (err) {
    console.error('[approvals/[id]] error:', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to process approval' },
      { status: 500 },
    )
  }
}

// ------------------------------------------------------------
// Invoice approval / rejection
// ------------------------------------------------------------
async function handleInvoiceApproval(
  req: NextRequest,
  id: string,
  businessId: string,
  action: 'approve' | 'reject',
  reason: string,
  userId: string,
  tenantId: string | null,
) {
  const invoice = await db.salesInvoice.findFirst({
    where: { id, businessId },
    include: { party: true, lines: true },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.approvalStatus !== 'PENDING') {
    return NextResponse.json(
      { error: `Invoice is already ${invoice.approvalStatus}` },
      { status: 400 },
    )
  }

  if (action === 'reject') {
    const updated = await db.salesInvoice.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    })
    void logActivity(businessId, userId, 'SALES_INVOICE', id, 'REJECTED',
      `Invoice ${invoice.number} approval rejected${reason ? `: ${reason}` : ''}`)
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'REJECTED', 'SALES_INVOICE', id,
        `Invoice ${invoice.number} approval rejected`, undefined, getClientIp(req))
    }
    return NextResponse.json({ ok: true, id, type: 'SALES_INVOICE', approvalStatus: 'REJECTED', reason })
  }

  // action === 'approve' — post the journal entry and mark as POSTED
  const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
  const salesAccount = await db.account.findFirst({ where: { businessId, subtype: 'SALES' } })
  const vatOutputAccount = await db.account.findFirst({ where: { businessId, code: '2220' } })

  const total = toNumber(money(invoice.total))
  const subtotal = toNumber(money(invoice.subtotal))
  const tax = toNumber(money(invoice.totalTax))

  if (arAccount && salesAccount) {
    await postJournalEntry({
      businessId,
      userId,
      date: invoice.date,
      reference: `Invoice ${invoice.number}`,
      description: `Sales Invoice ${invoice.number} - ${invoice.party.name} (approved)`,
      sourceType: 'SALES_INVOICE',
      sourceId: invoice.id,
      lines: [
        { accountId: arAccount.id, debit: total, credit: 0, partyId: invoice.partyId, description: `Invoice ${invoice.number}` },
        { accountId: salesAccount.id, debit: 0, credit: subtotal, description: `Sales - ${invoice.number}` },
        ...(vatOutputAccount && tax > 0
          ? [{ accountId: vatOutputAccount.id, debit: 0, credit: tax, description: `Output VAT - ${invoice.number}` }]
          : []),
      ],
    })
  }

  const updated = await db.salesInvoice.update({
    where: { id },
    data: {
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      status: 'POSTED',
      postedAt: new Date(),
      einvoiceUuid: generateEInvoiceUuid(),
    },
  })

  void logActivity(businessId, userId, 'SALES_INVOICE', id, 'APPROVED',
    `Invoice ${invoice.number} approved and posted`, { total })
  if (tenantId) {
    void logAudit(businessId, tenantId, userId, 'APPROVED', 'SALES_INVOICE', id,
      `Invoice ${invoice.number} approved and posted`, undefined, getClientIp(req))
  }

  return NextResponse.json({
    ok: true,
    id,
    type: 'SALES_INVOICE',
    approvalStatus: 'APPROVED',
    status: 'POSTED',
  })
}

// ------------------------------------------------------------
// Bill approval / rejection
// ------------------------------------------------------------
async function handleBillApproval(
  req: NextRequest,
  id: string,
  businessId: string,
  action: 'approve' | 'reject',
  reason: string,
  userId: string,
  tenantId: string | null,
) {
  const bill = await db.purchaseBill.findFirst({
    where: { id, businessId },
    include: { party: true, lines: true },
  })
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  if (bill.approvalStatus !== 'PENDING') {
    return NextResponse.json(
      { error: `Bill is already ${bill.approvalStatus}` },
      { status: 400 },
    )
  }

  if (action === 'reject') {
    await db.purchaseBill.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    })
    void logActivity(businessId, userId, 'PURCHASE_BILL', id, 'REJECTED',
      `Bill ${bill.number} approval rejected${reason ? `: ${reason}` : ''}`)
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'REJECTED', 'PURCHASE_BILL', id,
        `Bill ${bill.number} approval rejected`, undefined, getClientIp(req))
    }
    return NextResponse.json({ ok: true, id, type: 'PURCHASE_BILL', approvalStatus: 'REJECTED', reason })
  }

  // action === 'approve'
  const apAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_PAYABLE' } })
  const purchasesAccount = await db.account.findFirst({ where: { businessId, subtype: 'COST_OF_GOODS_SOLD' } })
  const vatInputAccount = await db.account.findFirst({ where: { businessId, code: '2210' } })

  const subtotal = toNumber(money(bill.subtotal))
  const tax = toNumber(money(bill.totalTax))
  const total = toNumber(money(bill.total))

  if (apAccount && purchasesAccount) {
    await postJournalEntry({
      businessId,
      userId,
      date: bill.date,
      reference: `Bill ${bill.number}`,
      description: `Purchase Bill ${bill.number} - ${bill.party.name} (approved)`,
      sourceType: 'PURCHASE_BILL',
      sourceId: bill.id,
      lines: [
        { accountId: purchasesAccount.id, debit: subtotal, credit: 0, description: `Purchase - ${bill.number}` },
        ...(vatInputAccount && tax > 0
          ? [{ accountId: vatInputAccount.id, debit: tax, credit: 0, description: `Input VAT - ${bill.number}` }]
          : []),
        { accountId: apAccount.id, debit: 0, credit: total, partyId: bill.partyId, description: `Bill ${bill.number}` },
      ],
    })
  }

  await db.purchaseBill.update({
    where: { id },
    data: {
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      status: 'POSTED',
      postedAt: new Date(),
    },
  })

  void logActivity(businessId, userId, 'PURCHASE_BILL', id, 'APPROVED',
    `Bill ${bill.number} approved and posted`, { total })
  if (tenantId) {
    void logAudit(businessId, tenantId, userId, 'APPROVED', 'PURCHASE_BILL', id,
      `Bill ${bill.number} approved and posted`, undefined, getClientIp(req))
  }

  return NextResponse.json({
    ok: true,
    id,
    type: 'PURCHASE_BILL',
    approvalStatus: 'APPROVED',
    status: 'POSTED',
  })
}

// ------------------------------------------------------------
// Payment approval / rejection
// ------------------------------------------------------------
async function handlePaymentApproval(
  req: NextRequest,
  id: string,
  businessId: string,
  action: 'approve' | 'reject',
  reason: string,
  userId: string,
  tenantId: string | null,
) {
  const payment = await db.payment.findFirst({
    where: { id, businessId },
    include: { allocations: true, party: true },
  })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.approvalStatus !== 'PENDING') {
    return NextResponse.json(
      { error: `Payment is already ${payment.approvalStatus}` },
      { status: 400 },
    )
  }

  if (action === 'reject') {
    await db.payment.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    })
    void logActivity(businessId, userId, 'PAYMENT', id, 'REJECTED',
      `${payment.type === 'RECEIPT' ? 'Receipt' : 'Payment'} ${payment.number} approval rejected${reason ? `: ${reason}` : ''}`)
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'REJECTED', 'PAYMENT', id,
        `Payment ${payment.number} approval rejected`, undefined, getClientIp(req))
    }
    return NextResponse.json({ ok: true, id, type: 'PAYMENT', approvalStatus: 'REJECTED', reason })
  }

  // action === 'approve' — post the journal entry
  const isReceipt = payment.type === 'RECEIPT'
  const amount = toNumber(money(payment.amount))

  // Apply allocations to invoices/bills
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

  // Post journal entry — same logic as /api/payments POST
  const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
  const apAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_PAYABLE' } })
  let bankAccount: { accountId: string | null } | null = null
  if (payment.bankAccountId) {
    bankAccount = await db.bankAccount.findUnique({ where: { id: payment.bankAccountId }, select: { accountId: true } })
  }
  const cashAccount = await db.account.findFirst({ where: { businessId, subtype: 'CASH' } })
  const bankGlAccount = bankAccount?.accountId
    ? await db.account.findUnique({ where: { id: bankAccount.accountId } })
    : await db.account.findFirst({ where: { businessId, subtype: 'BANK' } })

  const cashOrBank = bankGlAccount || cashAccount

  if (cashOrBank) {
    if (isReceipt && arAccount) {
      await postJournalEntry({
        businessId,
        userId,
        date: payment.date,
        reference: `Receipt ${payment.number}`,
        description: `Receipt from ${payment.party?.name || ''} (approved)`,
        sourceType: 'PAYMENT',
        sourceId: payment.id,
        lines: [
          { accountId: cashOrBank.id, debit: amount, credit: 0, description: `Receipt ${payment.number}` },
          { accountId: arAccount.id, debit: 0, credit: amount, partyId: payment.partyId, description: `Receipt ${payment.number}` },
        ],
      })
    } else if (!isReceipt && apAccount) {
      await postJournalEntry({
        businessId,
        userId,
        date: payment.date,
        reference: `Payment ${payment.number}`,
        description: `Payment to ${payment.party?.name || ''} (approved)`,
        sourceType: 'PAYMENT',
        sourceId: payment.id,
        lines: [
          { accountId: apAccount.id, debit: amount, credit: 0, partyId: payment.partyId, description: `Payment ${payment.number}` },
          { accountId: cashOrBank.id, debit: 0, credit: amount, description: `Payment ${payment.number}` },
        ],
      })
    }
  }

  await db.payment.update({
    where: { id },
    data: {
      approvalStatus: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      status: 'POSTED',
    },
  })

  void logActivity(businessId, userId, 'PAYMENT', id, 'APPROVED',
    `${isReceipt ? 'Receipt' : 'Payment'} ${payment.number} approved and posted`, { amount })
  if (tenantId) {
    void logAudit(businessId, tenantId, userId, 'APPROVED', 'PAYMENT', id,
      `Payment ${payment.number} approved and posted`, undefined, getClientIp(req))
  }

  return NextResponse.json({
    ok: true,
    id,
    type: 'PAYMENT',
    approvalStatus: 'APPROVED',
    status: 'POSTED',
  })
}
