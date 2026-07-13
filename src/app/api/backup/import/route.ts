import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { setBusinessSetting } from '@/lib/settings'
import { Decimal } from '@/lib/decimal'

// POST /api/backup/import — import business data from a JSON payload
//
// Body shape:
// {
//   mode?: 'replace' | 'merge'  (default 'merge')
//   data: { accounts: [...], parties: [...], invoices: [...], ... }
// }
//
// Note: This is a best-effort importer — it does NOT re-post journal entries
// (those would have been posted in the source business). Records with unique
// constraint violations are skipped, not overwritten, when in 'merge' mode.
export async function POST(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const tenantId = await getCurrentTenantId()
  const session = await getSession()

  const body = await req.json()
  const mode: 'replace' | 'merge' = body.mode === 'replace' ? 'replace' : 'merge'
  const data = body.data || body.payload || body

  if (!data || typeof data !== 'object') {
    return NextResponse.json({ error: 'No data provided' }, { status: 400 })
  }

  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const imported = {
    accounts: 0,
    parties: 0,
    items: 0,
    taxRates: 0,
    currencies: 0,
    customFields: 0,
    pdfTemplates: 0,
    bankAccounts: 0,
    journalEntries: 0,
    invoices: 0,
    bills: 0,
    payments: 0,
    quotations: 0,
    creditNotes: 0,
    deliveryNotes: 0,
    skipped: 0,
  }

  // Helper: safely create a record, count skips on unique-violation
  const safeCreate = async (promise: Promise<unknown>): Promise<boolean> => {
    try {
      await promise
      return true
    } catch {
      imported.skipped++
      return false
    }
  }

  // Optional replace mode: wipe existing business-scoped records first
  if (mode === 'replace') {
    await db.journalEntry.deleteMany({ where: { businessId } }).catch(() => {})
    await db.salesInvoice.deleteMany({ where: { businessId } }).catch(() => {})
    await db.purchaseBill.deleteMany({ where: { businessId } }).catch(() => {})
    await db.payment.deleteMany({ where: { businessId } }).catch(() => {})
    await db.quotation.deleteMany({ where: { businessId } }).catch(() => {})
    await db.creditNote.deleteMany({ where: { businessId } }).catch(() => {})
    await db.deliveryNote.deleteMany({ where: { businessId } }).catch(() => {})
    await db.item.deleteMany({ where: { businessId } }).catch(() => {})
    await db.party.deleteMany({ where: { businessId } }).catch(() => {})
    await db.account.deleteMany({ where: { businessId } }).catch(() => {})
    await db.bankAccount.deleteMany({ where: { businessId } }).catch(() => {})
    await db.taxRate.deleteMany({ where: { businessId } }).catch(() => {})
    await db.currency.deleteMany({ where: { businessId } }).catch(() => {})
    await db.customFieldDefinition.deleteMany({ where: { businessId } }).catch(() => {})
    await db.pdfTemplate.deleteMany({ where: { businessId } }).catch(() => {})
  }

  // Accounts (must be created first — everything else references them)
  const accountMap = new Map<string, string>() // old id -> new id
  for (const a of data.accounts || []) {
    const { id, businessId: _b, createdAt, updatedAt, parent, children, journalLines, ...rest } = a as any
    const created = await db.account
      .create({
        data: {
          ...rest,
          businessId,
          openingBalance: new Decimal(rest.openingBalance || 0),
          parentId: undefined, // re-link below
        },
      })
      .catch(() => null)
    if (created) {
      accountMap.set(id, created.id)
      imported.accounts++
    } else {
      imported.skipped++
    }
  }
  // Re-link parent accounts
  for (const a of data.accounts || []) {
    const oldParentId = (a as any).parentId
    if (oldParentId && accountMap.has(oldParentId) && accountMap.has((a as any).id)) {
      await db.account
        .update({
          where: { id: accountMap.get((a as any).id)! },
          data: { parentId: accountMap.get(oldParentId)! },
        })
        .catch(() => {})
    }
  }

  // Parties
  const partyMap = new Map<string, string>()
  for (const p of data.parties || []) {
    const { id, businessId: _b, createdAt, updatedAt, ...rest } = p as any
    const created = await db.party
      .create({
        data: {
          ...rest,
          businessId,
          creditLimit: new Decimal(rest.creditLimit || 0),
          openingBalance: new Decimal(rest.openingBalance || 0),
        },
      })
      .catch(() => null)
    if (created) {
      partyMap.set(id, created.id)
      imported.parties++
    } else {
      imported.skipped++
    }
  }

  // Tax rates
  const taxRateMap = new Map<string, string>()
  for (const t of data.taxRates || []) {
    const { id, businessId: _b, createdAt, ...rest } = t as any
    const created = await db.taxRate
      .create({ data: { ...rest, businessId, rate: new Decimal(rest.rate || 0) } })
      .catch(() => null)
    if (created) {
      taxRateMap.set(id, created.id)
      imported.taxRates++
    } else {
      imported.skipped++
    }
  }

  // Currencies
  for (const c of data.currencies || []) {
    const { id, businessId: _b, createdAt, updatedAt, ...rest } = c as any
    if (
      await safeCreate(
        db.currency.create({
          data: { ...rest, businessId, exchangeRate: new Decimal(rest.exchangeRate || 1) },
        })
      )
    )
      imported.currencies++
  }

  // Items
  const itemMap = new Map<string, string>()
  for (const it of data.items || []) {
    const { id, businessId: _b, createdAt, updatedAt, stockMovements, ...rest } = it as any
    const created = await db.item
      .create({
        data: {
          ...rest,
          businessId,
          salePrice: new Decimal(rest.salePrice || 0),
          purchasePrice: new Decimal(rest.purchasePrice || 0),
          stockQty: new Decimal(rest.stockQty || 0),
          reorderLevel: new Decimal(rest.reorderLevel || 0),
        },
      })
      .catch(() => null)
    if (created) {
      itemMap.set(id, created.id)
      imported.items++
    } else {
      imported.skipped++
    }
  }

  // Custom fields
  for (const cf of data.customFields || []) {
    const { id, businessId: _b, createdAt, ...rest } = cf as any
    if (await safeCreate(db.customFieldDefinition.create({ data: { ...rest, businessId } })))
      imported.customFields++
  }

  // PDF templates
  for (const tpl of data.pdfTemplates || []) {
    const { id, businessId: _b, createdAt, updatedAt, ...rest } = tpl as any
    if (await safeCreate(db.pdfTemplate.create({ data: { ...rest, businessId } })))
      imported.pdfTemplates++
  }

  // Bank accounts
  const bankMap = new Map<string, string>()
  for (const ba of data.bankAccounts || []) {
    const { id, businessId: _b, createdAt, updatedAt, transactions, ...rest } = ba as any
    const created = await db.bankAccount
      .create({
        data: {
          ...rest,
          businessId,
          openingBalance: new Decimal(rest.openingBalance || 0),
          currentBalance: new Decimal(rest.currentBalance || 0),
        },
      })
      .catch(() => null)
    if (created) {
      bankMap.set(id, created.id)
      imported.bankAccounts++
    } else {
      imported.skipped++
    }
  }

  // Bank transactions
  for (const bt of data.bankTransactions || []) {
    const { id, bankAccountId, createdAt, bankAccount, ...rest } = bt as any
    const newBankId = bankMap.get(bankAccountId) || bankAccountId
    await safeCreate(db.bankTransaction.create({ data: { ...rest, bankAccountId: newBankId } }))
  }

  // Journal entries (re-map account & party IDs; do not re-post)
  const journalMap = new Map<string, string>()
  for (const je of data.journalEntries || []) {
    const { id, businessId: _b, createdAt, updatedAt, createdBy, lines, number, ...rest } = je as any
    const userId = session?.userId || (await db.user.findFirst())?.id
    if (!userId) continue
    const created = await db.journalEntry
      .create({
        data: {
          ...rest,
          businessId,
          number: `${number || `JE-IMPORT-${Date.now()}`}`,
          createdById: userId,
          lines: {
            create: (lines || []).map((l: any) => ({
              accountId: accountMap.get(l.accountId || l.account?.id) || l.accountId,
              debit: new Decimal(l.debit || 0),
              credit: new Decimal(l.credit || 0),
              description: l.description,
              partyId: l.partyId ? partyMap.get(l.partyId) || l.partyId : null,
            })),
          },
        },
      })
      .catch(() => null)
    if (created) {
      journalMap.set(id, created.id)
      imported.journalEntries++
    } else {
      imported.skipped++
    }
  }

  // Helper for line-based documents (invoices, bills, quotations, etc.)
  // The `db` delegate for each table has a different create() signature, so
  // we dispatch via an explicit switch instead of indexing `db[table]`
  // (TypeScript can't unify the union of delegate types).
  const importDoc = async (
    table: 'salesInvoice' | 'purchaseBill' | 'quotation' | 'creditNote' | 'deliveryNote',
    lineField: string,
    docs: any[]
  ) => {
    const userId = session?.userId
    const requiresUser = table === 'salesInvoice' || table === 'purchaseBill'
    for (const d of docs) {
      const { id, businessId: _b, createdAt, updatedAt, party, lines, createdById, ...rest } = d
      const newPartyId = partyMap.get(d.partyId)
      if (!newPartyId) {
        imported.skipped++
        continue
      }
      const docUserId = userId || createdById
      if (requiresUser && !docUserId) {
        imported.skipped++
        continue
      }
      const data: any = {
        ...rest,
        businessId,
        partyId: newPartyId,
      }
      if (requiresUser) data.createdById = docUserId
      if (lines && Array.isArray(lines)) {
        data[lineField] = {
          create: lines.map((l: any) => {
            const { id: _lId, taxRate, account, party, taxRateId, ...lRest } = l
            const mapped: any = { ...lRest }
            if (taxRateId) mapped.taxRateId = taxRateMap.get(taxRateId) || null
            if (lRest.lineTotal) mapped.lineTotal = new Decimal(lRest.lineTotal)
            if (lRest.lineTax) mapped.lineTax = new Decimal(lRest.lineTax)
            if (lRest.quantity) mapped.quantity = new Decimal(lRest.quantity)
            if (lRest.unitPrice) mapped.unitPrice = new Decimal(lRest.unitPrice)
            if (lRest.discount !== undefined) mapped.discount = new Decimal(lRest.discount)
            return mapped
          }),
        }
      }
      // Map decimal fields
      for (const f of ['subtotal', 'totalDiscount', 'totalTax', 'total', 'amountPaid']) {
        if (data[f] !== undefined) data[f] = new Decimal(data[f] || 0)
      }
      let created: any = null
      try {
        switch (table) {
          case 'salesInvoice':
            created = await db.salesInvoice.create({ data })
            break
          case 'purchaseBill':
            created = await db.purchaseBill.create({ data })
            break
          case 'quotation':
            created = await db.quotation.create({ data })
            break
          case 'creditNote':
            created = await db.creditNote.create({ data })
            break
          case 'deliveryNote':
            created = await db.deliveryNote.create({ data })
            break
        }
      } catch {
        created = null
      }
      if (created) {
        if (table === 'salesInvoice') imported.invoices++
        else if (table === 'purchaseBill') imported.bills++
        else if (table === 'quotation') imported.quotations++
        else if (table === 'creditNote') imported.creditNotes++
        else if (table === 'deliveryNote') imported.deliveryNotes++
      } else {
        imported.skipped++
      }
    }
  }

  await importDoc('salesInvoice', 'lines', data.invoices || [])
  await importDoc('purchaseBill', 'lines', data.bills || [])
  await importDoc('quotation', 'lines', data.quotations || [])
  await importDoc('creditNote', 'lines', data.creditNotes || [])
  await importDoc('deliveryNote', 'lines', data.deliveryNotes || [])

  // Payments — need user and party remap
  const userId = session?.userId
  for (const p of data.payments || []) {
    const { id, businessId: _b, createdAt, updatedAt, party, allocations, createdById, ...rest } = p
    const newPartyId = partyMap.get(p.partyId)
    const docUserId = userId || createdById
    if (!newPartyId || !docUserId) {
      imported.skipped++
      continue
    }
    const created = await db.payment
      .create({
        data: {
          ...rest,
          businessId,
          partyId: newPartyId,
          createdById: docUserId,
          amount: new Decimal(p.amount || 0),
          exchangeRate: new Decimal(p.exchangeRate || 1),
        },
      })
      .catch(() => null)
    if (created) imported.payments++
    else imported.skipped++
  }

  // Record import metadata as a backup snapshot
  await setBusinessSetting(businessId, 'last_backup', {
    at: new Date().toISOString(),
    size: Buffer.byteLength(JSON.stringify(data), 'utf8'),
    records: Object.values(imported).reduce((s, n) => s + (n as number), 0),
  })

  // Audit log (best-effort)
  if (tenantId && session?.userId) {
    await db.auditLog
      .create({
        data: {
          businessId,
          tenantId,
          userId: session.userId,
          action: 'BACKUP_IMPORT',
          entityType: 'BUSINESS',
          entityId: businessId,
          description: `Imported backup (${mode} mode): ${JSON.stringify(imported)}`,
        },
      })
      .catch(() => {})
  }

  return NextResponse.json({ ok: true, mode, imported })
}
