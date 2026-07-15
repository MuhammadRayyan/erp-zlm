import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ensureBusinessId,
  getCurrentTenantId,
  getSession,
  hasPermission,
  AuthError,
} from '@/lib/auth'
import { postJournalEntry, reverseJournalEntry } from '@/lib/journal-service'
import { money, toNumber } from '@/lib/decimal'
import { generateEInvoiceUuid } from '@/lib/vat-service'
import { logActivity, logAudit, getClientIp } from '@/lib/activity-logger'

// ============================================================
// BULK OPERATIONS API
// ============================================================
// POST /api/bulk
// Body: {
//   type: 'invoice' | 'bill' | 'party' | 'item',
//   action: 'delete' | 'post' | 'void' | 'export',
//   ids: string[]
// }
// Returns: { success: number, failed: number, errors: string[], data?: unknown }
// ============================================================

type BulkType = 'invoice' | 'bill' | 'party' | 'item'
type BulkAction = 'delete' | 'post' | 'void' | 'export'

interface BulkBody {
  type: BulkType
  action: BulkAction
  ids: string[]
}

interface BulkResult {
  success: number
  failed: number
  errors: string[]
  data?: unknown
}

export async function POST(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (
      e instanceof AuthError ||
      (e as Error).message === 'Not authenticated'
    ) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      )
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 },
    )
  }
  const user = { id: session.userId, name: session.name, email: session.email }
  const tenantId = await getCurrentTenantId()

  let body: BulkBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { type, action, ids } = body || {}

  if (!type || !action || !Array.isArray(ids)) {
    return NextResponse.json(
      { error: 'Missing required fields: type, action, ids' },
      { status: 400 },
    )
  }

  const VALID_TYPES: BulkType[] = ['invoice', 'bill', 'party', 'item']
  const VALID_ACTIONS: BulkAction[] = ['delete', 'post', 'void', 'export']

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type: ${type}` },
      { status: 400 },
    )
  }
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Invalid action: ${action}` },
      { status: 400 },
    )
  }
  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'No records selected' },
      { status: 400 },
    )
  }

  // Permission check — destructive actions (delete, post, void) require
  // tenant.accounting. Export is read-only so any tenant member may use it.
  if (action !== 'export') {
    if (!(await hasPermission('tenant.accounting'))) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions — VIEWER role cannot perform bulk mutations',
        },
        { status: 403 },
      )
    }
  }

  const result: BulkResult = { success: 0, failed: 0, errors: [] }

  if (action === 'export') {
    try {
      const data = await exportRecords(type, ids, businessId)
      result.success = ids.length
      result.data = data
    } catch (e) {
      result.failed = ids.length
      result.errors.push((e as Error).message)
    }
    return NextResponse.json(result)
  }

  // Mutating actions — process each id sequentially so failures don't abort the batch
  for (const id of ids) {
    try {
      if (type === 'invoice') {
        await bulkInvoiceAction(businessId, user.id, tenantId, action, id, req)
      } else if (type === 'bill') {
        await bulkBillAction(businessId, user.id, tenantId, action, id, req)
      } else if (type === 'party') {
        await bulkPartyAction(businessId, user.id, tenantId, action, id, req)
      } else if (type === 'item') {
        await bulkItemAction(businessId, user.id, tenantId, action, id, req)
      }
      result.success++
    } catch (e) {
      result.failed++
      result.errors.push(`[${type}:${id}] ${(e as Error).message}`)
    }
  }

  return NextResponse.json(result)
}

// ============================================================
// EXPORT — return all selected records as a JSON array
// ============================================================
async function exportRecords(
  type: BulkType,
  ids: string[],
  businessId: string,
): Promise<unknown[]> {
  if (type === 'invoice') {
    const records = await db.salesInvoice.findMany({
      where: { id: { in: ids }, businessId },
      include: {
        party: true,
        lines: { include: { taxRate: true } },
      },
    })
    return records.map((inv) => ({
      id: inv.id,
      number: inv.number,
      date: inv.date,
      dueDate: inv.dueDate,
      partyName: inv.party.name,
      reference: inv.reference,
      currency: inv.currency,
      subtotal: toNumber(inv.subtotal),
      totalTax: toNumber(inv.totalTax),
      total: toNumber(inv.total),
      amountPaid: toNumber(inv.amountPaid),
      balanceDue: toNumber(money(inv.total).minus(money(inv.amountPaid))),
      status: inv.status,
      notes: inv.notes,
      terms: inv.terms,
      lines: inv.lines.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: toNumber(l.quantity),
        unitPrice: toNumber(l.unitPrice),
        discount: toNumber(l.discount),
        taxRate: l.taxRate ? toNumber(l.taxRate.rate) : 0,
        lineTotal: toNumber(l.lineTotal),
        lineTax: toNumber(l.lineTax),
      })),
    }))
  }

  if (type === 'bill') {
    const records = await db.purchaseBill.findMany({
      where: { id: { in: ids }, businessId },
      include: {
        party: true,
        lines: { include: { taxRate: true } },
      },
    })
    return records.map((b) => ({
      id: b.id,
      number: b.number,
      date: b.date,
      dueDate: b.dueDate,
      partyName: b.party.name,
      supplierInvoiceNumber: b.supplierInvoiceNumber,
      reference: b.reference,
      currency: b.currency,
      subtotal: toNumber(b.subtotal),
      totalTax: toNumber(b.totalTax),
      total: toNumber(b.total),
      amountPaid: toNumber(b.amountPaid),
      balanceDue: toNumber(money(b.total).minus(money(b.amountPaid))),
      status: b.status,
      notes: b.notes,
      lines: b.lines.map((l) => ({
        id: l.id,
        description: l.description,
        quantity: toNumber(l.quantity),
        unitPrice: toNumber(l.unitPrice),
        discount: toNumber(l.discount),
        taxRate: l.taxRate ? toNumber(l.taxRate.rate) : 0,
        lineTotal: toNumber(l.lineTotal),
        lineTax: toNumber(l.lineTax),
      })),
    }))
  }

  if (type === 'party') {
    const records = await db.party.findMany({
      where: { id: { in: ids }, businessId },
    })
    return records.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      nameAr: p.nameAr,
      type: p.type,
      trn: p.trn,
      email: p.email,
      phone: p.phone,
      contactPerson: p.contactPerson,
      city: p.billingCity,
      state: p.billingState,
      country: p.billingCountry,
      paymentTerms: p.paymentTerms,
      creditLimit: toNumber(p.creditLimit),
      openingBalance: toNumber(p.openingBalance),
      isActive: p.isActive,
    }))
  }

  // items
  const records = await db.item.findMany({
    where: { id: { in: ids }, businessId },
  })
  return records.map((i) => ({
    id: i.id,
    sku: i.sku,
    name: i.name,
    nameAr: i.nameAr,
    description: i.description,
    unit: i.unit,
    category: i.category,
    salePrice: toNumber(i.salePrice),
    purchasePrice: toNumber(i.purchasePrice),
    stockQty: toNumber(i.stockQty),
    reorderLevel: toNumber(i.reorderLevel),
    isInventory: i.isInventory,
    isActive: i.isActive,
  }))
}

// ============================================================
// INVOICE bulk actions: delete (DRAFT only), post (DRAFT only), void (POSTED only)
// ============================================================
async function bulkInvoiceAction(
  businessId: string,
  userId: string,
  tenantId: string | null,
  action: BulkAction,
  id: string,
  req: NextRequest,
) {
  const invoice = await db.salesInvoice.findUnique({
    where: { id },
    include: { party: true, lines: true },
  })
  if (!invoice) throw new Error('Invoice not found')
  if (invoice.businessId !== businessId) throw new Error('Invoice not in current business')

  if (action === 'delete') {
    if (invoice.status !== 'DRAFT') {
      throw new Error(`Only DRAFT invoices can be deleted (status: ${invoice.status})`)
    }
    // Remove invoice lines then the invoice
    await db.salesInvoiceLine.deleteMany({ where: { invoiceId: id } })
    await db.salesInvoice.delete({ where: { id } })
    void logActivity(businessId, userId, 'SALES_INVOICE', id, 'DELETED',
      `Invoice ${invoice.number} deleted (bulk)`)
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'DELETED', 'SALES_INVOICE', id,
        `Invoice ${invoice.number} deleted (bulk)`, undefined, getClientIp(req))
    }
    return
  }

  if (action === 'post') {
    if (invoice.status !== 'DRAFT') {
      throw new Error(`Only DRAFT invoices can be posted (status: ${invoice.status})`)
    }

    // Period lock check
    const { isPeriodLocked } = await import('@/lib/period-lock')
    if (await isPeriodLocked(businessId, new Date(invoice.date))) {
      throw new Error('Period locked')
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
        userId,
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

    await db.salesInvoice.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date(), einvoiceUuid: generateEInvoiceUuid() },
    })

    void logActivity(businessId, userId, 'SALES_INVOICE', id, 'POSTED',
      `Invoice ${invoice.number} posted (bulk)`, { total: toNumber(money(invoice.total)) })
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'POSTED', 'SALES_INVOICE', id,
        `Invoice ${invoice.number} posted (bulk)`, undefined, getClientIp(req))
    }
    return
  }

  if (action === 'void') {
    if (invoice.status === 'VOID') {
      throw new Error('Invoice is already void')
    }
    if (invoice.status === 'DRAFT') {
      throw new Error('Use delete for DRAFT invoices; void is for POSTED records')
    }

    // Reverse the journal entry
    const je = await db.journalEntry.findFirst({ where: { sourceType: 'SALES_INVOICE', sourceId: id } })
    if (je) {
      await reverseJournalEntry(je.id, userId, `Void of invoice ${invoice.number} (bulk)`)
    }

    await db.salesInvoice.update({ where: { id }, data: { status: 'VOID' } })

    void logActivity(businessId, userId, 'SALES_INVOICE', id, 'VOIDED',
      `Invoice ${invoice.number} voided (bulk)`)
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'VOIDED', 'SALES_INVOICE', id,
        `Invoice ${invoice.number} voided (bulk)`, undefined, getClientIp(req))
    }
    return
  }

  throw new Error(`Unsupported action ${action} for invoices`)
}

// ============================================================
// BILL bulk actions: delete (DRAFT only), post (DRAFT only), void (POSTED only)
// ============================================================
async function bulkBillAction(
  businessId: string,
  userId: string,
  tenantId: string | null,
  action: BulkAction,
  id: string,
  req: NextRequest,
) {
  const bill = await db.purchaseBill.findUnique({
    where: { id },
    include: { party: true },
  })
  if (!bill) throw new Error('Bill not found')
  if (bill.businessId !== businessId) throw new Error('Bill not in current business')

  if (action === 'delete') {
    if (bill.status !== 'DRAFT') {
      throw new Error(`Only DRAFT bills can be deleted (status: ${bill.status})`)
    }
    await db.purchaseBillLine.deleteMany({ where: { billId: id } })
    await db.purchaseBill.delete({ where: { id } })
    void logActivity(businessId, userId, 'PURCHASE_BILL', id, 'DELETED',
      `Bill ${bill.number} deleted (bulk)`)
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'DELETED', 'PURCHASE_BILL', id,
        `Bill ${bill.number} deleted (bulk)`, undefined, getClientIp(req))
    }
    return
  }

  if (action === 'post') {
    if (bill.status !== 'DRAFT') {
      throw new Error(`Only DRAFT bills can be posted (status: ${bill.status})`)
    }

    const { isPeriodLocked } = await import('@/lib/period-lock')
    if (await isPeriodLocked(businessId, new Date(bill.date))) {
      throw new Error('Period locked')
    }

    const apAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_PAYABLE' } })
    const purchasesAccount = await db.account.findFirst({ where: { businessId, subtype: 'COST_OF_GOODS_SOLD' } })
    const vatInputAccount = await db.account.findFirst({ where: { businessId, code: '2210' } })

    if (apAccount && purchasesAccount) {
      const subtotal = toNumber(money(bill.subtotal))
      const tax = toNumber(money(bill.totalTax))
      const total = toNumber(money(bill.total))

      await postJournalEntry({
        businessId, userId, date: bill.date,
        reference: `Bill ${bill.number}`, description: `Purchase Bill ${bill.number} - ${bill.party.name}`,
        sourceType: 'PURCHASE_BILL', sourceId: bill.id,
        lines: [
          { accountId: purchasesAccount.id, debit: subtotal, credit: 0, description: `Purchase - ${bill.number}` },
          ...(vatInputAccount && tax > 0 ? [{ accountId: vatInputAccount.id, debit: tax, credit: 0, description: `Input VAT - ${bill.number}` }] : []),
          { accountId: apAccount.id, debit: 0, credit: total, partyId: bill.partyId, description: `Bill ${bill.number}` },
        ],
      })
    }

    await db.purchaseBill.update({ where: { id }, data: { status: 'POSTED', postedAt: new Date() } })
    void logActivity(businessId, userId, 'PURCHASE_BILL', id, 'POSTED',
      `Bill ${bill.number} posted (bulk)`, { total: toNumber(money(bill.total)) })
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'POSTED', 'PURCHASE_BILL', id,
        `Bill ${bill.number} posted (bulk)`, undefined, getClientIp(req))
    }
    return
  }

  if (action === 'void') {
    if (bill.status === 'VOID') throw new Error('Bill is already void')
    if (bill.status === 'DRAFT') throw new Error('Use delete for DRAFT bills; void is for POSTED records')

    const je = await db.journalEntry.findFirst({ where: { sourceType: 'PURCHASE_BILL', sourceId: id } })
    if (je) await reverseJournalEntry(je.id, userId, `Void of bill ${bill.number} (bulk)`)
    await db.purchaseBill.update({ where: { id }, data: { status: 'VOID' } })
    void logActivity(businessId, userId, 'PURCHASE_BILL', id, 'VOIDED',
      `Bill ${bill.number} voided (bulk)`)
    if (tenantId) {
      void logAudit(businessId, tenantId, userId, 'VOIDED', 'PURCHASE_BILL', id,
        `Bill ${bill.number} voided (bulk)`, undefined, getClientIp(req))
    }
    return
  }

  throw new Error(`Unsupported action ${action} for bills`)
}

// ============================================================
// PARTY bulk actions: delete only (parties have no post/void lifecycle)
// ============================================================
async function bulkPartyAction(
  businessId: string,
  userId: string,
  tenantId: string | null,
  action: BulkAction,
  id: string,
  req: NextRequest,
) {
  if (action !== 'delete') {
    throw new Error(`Action ${action} not supported for parties`)
  }
  const party = await db.party.findFirst({ where: { id, businessId } })
  if (!party) throw new Error('Party not found')
  if (party.businessId !== businessId) throw new Error('Party not in current business')

  // Block deletion if party has any transactions
  const counts = await Promise.all([
    db.salesInvoice.count({ where: { partyId: id } }),
    db.purchaseBill.count({ where: { partyId: id } }),
    db.payment.count({ where: { partyId: id } }),
    db.creditNote.count({ where: { partyId: id } }),
    db.deliveryNote.count({ where: { partyId: id } }),
    db.quotation.count({ where: { partyId: id } }),
    db.journalLine.count({ where: { partyId: id } }),
  ])
  const totalRefs = counts.reduce((s, c) => s + c, 0)
  if (totalRefs > 0) {
    throw new Error(
      `Cannot delete party with ${totalRefs} existing transaction(s)`,
    )
  }

  await db.party.delete({ where: { id } })
  void logActivity(businessId, userId, 'PARTY', id, 'DELETED',
    `Party ${party.name} deleted (bulk)`, { name: party.name })
  if (tenantId) {
    void logAudit(businessId, tenantId, userId, 'DELETED', 'PARTY', id,
      `Party ${party.name} deleted (bulk)`, undefined, getClientIp(req))
  }
}

// ============================================================
// ITEM bulk actions: delete only (items have no post/void lifecycle)
// ============================================================
async function bulkItemAction(
  businessId: string,
  userId: string,
  tenantId: string | null,
  action: BulkAction,
  id: string,
  req: NextRequest,
) {
  if (action !== 'delete') {
    throw new Error(`Action ${action} not supported for items`)
  }
  const item = await db.item.findFirst({ where: { id, businessId } })
  if (!item) throw new Error('Item not found')
  if (item.businessId !== businessId) throw new Error('Item not in current business')

  // Block deletion if item is referenced
  const counts = await Promise.all([
    db.salesInvoiceLine.count({ where: { itemId: id } }),
    db.purchaseBillLine.count({ where: { itemId: id } }),
    db.quotationLine.count({ where: { itemId: id } }),
    db.deliveryNoteLine.count({ where: { itemId: id } }),
    db.stockMovement.count({ where: { itemId: id } }),
  ])
  const totalRefs = counts.reduce((s, c) => s + c, 0)
  if (totalRefs > 0) {
    throw new Error(
      `Cannot delete item referenced in ${totalRefs} transaction line(s)`,
    )
  }

  await db.item.delete({ where: { id } })
  void logActivity(businessId, userId, 'ITEM', id, 'DELETED',
    `Item ${item.sku} - ${item.name} deleted (bulk)`, { sku: item.sku })
  if (tenantId) {
    void logAudit(businessId, tenantId, userId, 'DELETED', 'ITEM', id,
      `Item ${item.sku} - ${item.name} deleted (bulk)`, undefined, getClientIp(req))
  }
}
