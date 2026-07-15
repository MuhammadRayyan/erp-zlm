// ============================================================
// BACKUP / IMPORT / EXPORT UTILITIES
// ============================================================
// Exports and imports business/tenant/platform data as JSON.
// All exports are tenant-scoped for safety — callers MUST verify
// that the business belongs to the current tenant before calling.
// ============================================================

import { db } from './db'
import { toNumber } from './decimal'
import type { Decimal } from '@prisma/client/runtime/library'

// ============================================================
// TYPES
// ============================================================

export type ConflictResolution = 'skip' | 'overwrite'

export interface BackupMeta {
  version: string
  exportedAt: string
  scope: 'business' | 'tenant' | 'platform'
  businessId?: string
  businessName?: string
  tenantId?: string
  tenantName?: string
}

export interface BusinessBackup {
  business: Record<string, unknown>
  accounts: Record<string, unknown>[]
  parties: Record<string, unknown>[]
  salesInvoices: Record<string, unknown>[]
  purchaseBills: Record<string, unknown>[]
  quotations: Record<string, unknown>[]
  creditNotes: Record<string, unknown>[]
  deliveryNotes: Record<string, unknown>[]
  payments: Record<string, unknown>[]
  journalEntries: Record<string, unknown>[]
  items: Record<string, unknown>[]
  bankAccounts: Record<string, unknown>[]
  taxRates: Record<string, unknown>[]
  currencies: Record<string, unknown>[]
  customFields: Record<string, unknown>[]
  pdfTemplates: Record<string, unknown>[]
}

export interface TenantBackup {
  tenant: Record<string, unknown>
  businesses: BusinessBackup[]
}

export interface PlatformBackup {
  tenants: TenantBackup[]
}

export interface BackupPayload {
  meta: BackupMeta
  data: BusinessBackup | TenantBackup | PlatformBackup
}

export interface ImportSummary {
  imported: Record<string, number>
  skipped: Record<string, number>
  errors: { entity: string; id?: string; error: string }[]
  total: { imported: number; skipped: number }
}

// ============================================================
// DECIMAL HELPERS
// ============================================================

// Convert any Prisma record (which contains Decimal objects) into
// a plain-JSON-safe object where Decimals are converted to numbers.
function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = v
    } else if (typeof v === 'object' && v !== null && 'toFixed' in (v as object)) {
      // Decimal-like
      out[k] = toNumber(v as Decimal)
    } else if (v instanceof Date) {
      out[k] = v.toISOString()
    } else if (Array.isArray(v)) {
      out[k] = v.map(item =>
        item && typeof item === 'object' && !(item instanceof Date)
          ? serializeRow(item as Record<string, unknown>)
          : item instanceof Date
            ? item.toISOString()
            : item
      )
    } else if (typeof v === 'object') {
      out[k] = serializeRow(v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

// ============================================================
// EXPORT — SINGLE BUSINESS
// ============================================================

export async function exportBusinessData(businessId: string): Promise<BusinessBackup> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    include: {
      accounts: { orderBy: { code: 'asc' } },
      parties: { orderBy: { name: 'asc' } },
      items: { orderBy: { name: 'asc' } },
      bankAccounts: { orderBy: { name: 'asc' }, include: { transactions: true } },
      taxRates: { orderBy: { name: 'asc' } },
      currencies: { orderBy: { code: 'asc' } },
      customFields: { orderBy: [{ doctype: 'asc' }, { position: 'asc' }] },
      pdfTemplates: { orderBy: [{ doctype: 'asc' }, { name: 'asc' }] },
    },
  })

  if (!business) throw new Error('Business not found')

  const [salesInvoices, purchaseBills, quotations, creditNotes, deliveryNotes, payments, journalEntries] =
    await Promise.all([
      db.salesInvoice.findMany({
        where: { businessId },
        include: { lines: { include: { taxRate: true }, orderBy: { position: 'asc' } }, party: true },
        orderBy: { date: 'desc' },
      }),
      db.purchaseBill.findMany({
        where: { businessId },
        include: { lines: { include: { taxRate: true }, orderBy: { position: 'asc' } }, party: true },
        orderBy: { date: 'desc' },
      }),
      db.quotation.findMany({
        where: { businessId },
        include: { lines: { include: { taxRate: true }, orderBy: { position: 'asc' } }, party: true },
        orderBy: { date: 'desc' },
      }),
      db.creditNote.findMany({
        where: { businessId },
        include: { lines: { include: { taxRate: true }, orderBy: { position: 'asc' } }, party: true },
        orderBy: { date: 'desc' },
      }),
      db.deliveryNote.findMany({
        where: { businessId },
        include: { lines: { orderBy: { position: 'asc' } }, party: true },
        orderBy: { date: 'desc' },
      }),
      db.payment.findMany({
        where: { businessId },
        include: { allocations: true, party: true },
        orderBy: { date: 'desc' },
      }),
      db.journalEntry.findMany({
        where: { businessId },
        include: { lines: { include: { account: true } } },
        orderBy: { date: 'desc' },
      }),
    ])

  // Strip relation fields we don't want to persist (we'll re-attach on import).
  // We re-attach lines/allocations under _lines/_allocations keys for re-import.
  const strip = (row: Record<string, unknown>, drop: string[]): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!drop.includes(k)) out[k] = v
    }
    return out
  }
  const moveLines = (row: Record<string, unknown>, from: string, to: string): Record<string, unknown> => {
    const out = strip(row, [from])
    out[to] = row[from]
    return out
  }

  return {
    business: serializeRow(strip(business as unknown as Record<string, unknown>, ['accounts', 'parties', 'items', 'bankAccounts', 'taxRates', 'currencies', 'customFields', 'pdfTemplates', 'tenant', 'journalEntries', 'salesInvoices', 'purchaseBills', 'quotations', 'creditNotes', 'deliveryNotes', 'payments', 'warehouses', 'stockMovements', 'auditLogs', 'activities'])),
    accounts: (business.accounts || []).map(a => serializeRow(strip(a as unknown as Record<string, unknown>, ['business', 'parent', 'children', 'journalLines']))),
    parties: (business.parties || []).map(p => serializeRow(strip(p as unknown as Record<string, unknown>, ['business', 'invoices', 'bills', 'payments', 'journalLines', 'quotations', 'creditNotes', 'deliveryNotes']))),
    salesInvoices: salesInvoices.map(i => serializeRow(moveLines(strip(i as unknown as Record<string, unknown>, ['business', 'party', 'createdBy', 'payments']), 'lines', '_lines'))),
    purchaseBills: purchaseBills.map(b => serializeRow(moveLines(strip(b as unknown as Record<string, unknown>, ['business', 'party', 'createdBy', 'payments']), 'lines', '_lines'))),
    quotations: quotations.map(q => serializeRow(moveLines(strip(q as unknown as Record<string, unknown>, ['business', 'party', 'lines']), 'lines', '_lines'))),
    creditNotes: creditNotes.map(c => serializeRow(moveLines(strip(c as unknown as Record<string, unknown>, ['business', 'party', 'lines']), 'lines', '_lines'))),
    deliveryNotes: deliveryNotes.map(d => serializeRow(moveLines(strip(d as unknown as Record<string, unknown>, ['business', 'party', 'lines']), 'lines', '_lines'))),
    payments: payments.map(p => serializeRow(moveLines(strip(p as unknown as Record<string, unknown>, ['business', 'party', 'createdBy', 'allocations']), 'allocations', '_allocations'))),
    journalEntries: journalEntries.map(j => serializeRow(moveLines(strip(j as unknown as Record<string, unknown>, ['business', 'createdBy']), 'lines', '_lines'))),
    items: (business.items || []).map(i => serializeRow(strip(i as unknown as Record<string, unknown>, ['business', 'stockMovements']))),
    bankAccounts: (business.bankAccounts || []).map(b => serializeRow(moveLines(strip(b as unknown as Record<string, unknown>, ['business']), 'transactions', '_transactions'))),
    taxRates: (business.taxRates || []).map(t => serializeRow(strip(t as unknown as Record<string, unknown>, ['business', 'invoiceLines', 'billLines', 'quotationLines', 'creditNoteLines']))),
    currencies: (business.currencies || []).map(c => serializeRow(strip(c as unknown as Record<string, unknown>, ['business']))),
    customFields: (business.customFields || []).map(c => serializeRow(strip(c as unknown as Record<string, unknown>, ['business']))),
    pdfTemplates: (business.pdfTemplates || []).map(t => serializeRow(strip(t as unknown as Record<string, unknown>, ['business']))),
  }
}

// ============================================================
// EXPORT — TENANT (all businesses)
// ============================================================

export async function exportTenantData(tenantId: string): Promise<TenantBackup> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) throw new Error('Tenant not found')

  const businesses = await db.business.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  const businessBackups: BusinessBackup[] = []
  for (const b of businesses) {
    businessBackups.push(await exportBusinessData(b.id))
  }

  const { subscription, members, businesses: _b, auditLogs, ...tenantData } = tenant as unknown as Record<string, unknown>
  return {
    tenant: serializeRow(tenantData),
    businesses: businessBackups,
  }
}

// ============================================================
// EXPORT — PLATFORM (all tenants & businesses)
// ============================================================

export async function exportPlatformData(): Promise<PlatformBackup> {
  const tenants = await db.tenant.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  const tenantBackups: TenantBackup[] = []
  for (const t of tenants) {
    tenantBackups.push(await exportTenantData(t.id))
  }
  return { tenants: tenantBackups }
}

// ============================================================
// IMPORT — BUSINESS DATA
// ============================================================

// We import into a target business ID (the current business). The IDs in the
// backup may not match the target business, so we remap related entities
// (parties, accounts, items, tax rates) by their unique codes within the
// target business. This means we always look up or create them by their
// natural key.
export async function importBusinessData(
  targetBusinessId: string,
  userId: string,
  data: BusinessBackup,
  conflictResolution: ConflictResolution = 'skip'
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    imported: {},
    skipped: {},
    errors: [],
    total: { imported: 0, skipped: 0 },
  }

  const bump = (entity: string, ok: boolean) => {
    summary.imported[entity] = (summary.imported[entity] || 0) + (ok ? 1 : 0)
    summary.skipped[entity] = (summary.skipped[entity] || 0) + (ok ? 0 : 1)
    if (ok) summary.total.imported++
    else summary.total.skipped++
  }

  const recordError = (entity: string, error: string, id?: string) => {
    summary.errors.push({ entity, error, id })
  }

  // Verify business exists
  const target = await db.business.findUnique({ where: { id: targetBusinessId } })
  if (!target) throw new Error('Target business not found')

  // ID remaps (source id -> target id)
  const accountMap = new Map<string, string>()
  const partyMap = new Map<string, string>()
  const itemMap = new Map<string, string>()
  const taxRateMap = new Map<string, string>()
  const currencyMap = new Map<string, string>()

  // ----------------------------------------
  // 1. Accounts (by code)
  // ----------------------------------------
  for (const a of data.accounts || []) {
    try {
      const code = String(a.code || '')
      const existing = await db.account.findUnique({ where: { businessId_code: { businessId: targetBusinessId, code } } })
      if (existing) {
        accountMap.set(String(a.id), existing.id)
        if (conflictResolution === 'overwrite') {
          await db.account.update({ where: { id: existing.id }, data: accountData(a, targetBusinessId) })
          bump('accounts', true)
        } else {
          bump('accounts', false)
        }
      } else {
        const created = await db.account.create({ data: accountData(a, targetBusinessId) })
        accountMap.set(String(a.id), created.id)
        bump('accounts', true)
      }
    } catch (e) {
      recordError('accounts', (e as Error).message, String(a.id || ''))
    }
  }

  // ----------------------------------------
  // 2. Parties (by code or name)
  // ----------------------------------------
  for (const p of data.parties || []) {
    try {
      const code = p.code ? String(p.code) : null
      const name = String(p.name || '')
      let existing = null as Awaited<ReturnType<typeof db.party.findFirst>>
      if (code) {
        existing = await db.party.findUnique({ where: { businessId_code: { businessId: targetBusinessId, code } } })
      }
      if (!existing) {
        existing = await db.party.findFirst({ where: { businessId: targetBusinessId, name } })
      }
      if (existing) {
        partyMap.set(String(p.id), existing.id)
        if (conflictResolution === 'overwrite') {
          await db.party.update({ where: { id: existing.id }, data: partyData(p, targetBusinessId) })
          bump('parties', true)
        } else {
          bump('parties', false)
        }
      } else {
        const created = await db.party.create({ data: partyData(p, targetBusinessId) })
        partyMap.set(String(p.id), created.id)
        bump('parties', true)
      }
    } catch (e) {
      recordError('parties', (e as Error).message, String(p.id || ''))
    }
  }

  // ----------------------------------------
  // 3. Tax rates (by name)
  // ----------------------------------------
  for (const t of data.taxRates || []) {
    try {
      const name = String(t.name || '')
      const existing = await db.taxRate.findUnique({ where: { businessId_name: { businessId: targetBusinessId, name } } })
      if (existing) {
        taxRateMap.set(String(t.id), existing.id)
        if (conflictResolution === 'overwrite') {
          await db.taxRate.update({ where: { id: existing.id }, data: taxRateData(t, targetBusinessId) })
          bump('taxRates', true)
        } else {
          bump('taxRates', false)
        }
      } else {
        const created = await db.taxRate.create({ data: taxRateData(t, targetBusinessId) })
        taxRateMap.set(String(t.id), created.id)
        bump('taxRates', true)
      }
    } catch (e) {
      recordError('taxRates', (e as Error).message, String(t.id || ''))
    }
  }

  // ----------------------------------------
  // 4. Currencies (by code)
  // ----------------------------------------
  for (const c of data.currencies || []) {
    try {
      const code = String(c.code || '')
      const existing = await db.currency.findUnique({ where: { businessId_code: { businessId: targetBusinessId, code } } })
      if (existing) {
        currencyMap.set(String(c.id), existing.id)
        if (conflictResolution === 'overwrite') {
          await db.currency.update({ where: { id: existing.id }, data: currencyData(c, targetBusinessId) })
          bump('currencies', true)
        } else {
          bump('currencies', false)
        }
      } else {
        const created = await db.currency.create({ data: currencyData(c, targetBusinessId) })
        currencyMap.set(String(c.id), created.id)
        bump('currencies', true)
      }
    } catch (e) {
      recordError('currencies', (e as Error).message, String(c.id || ''))
    }
  }

  // ----------------------------------------
  // 5. Items (by sku)
  // ----------------------------------------
  for (const it of data.items || []) {
    try {
      const sku = String(it.sku || '')
      const existing = await db.item.findUnique({ where: { businessId_sku: { businessId: targetBusinessId, sku } } })
      const taxRateId = it.taxRateId ? (taxRateMap.get(String(it.taxRateId)) || null) : null
      if (existing) {
        itemMap.set(String(it.id), existing.id)
        if (conflictResolution === 'overwrite') {
          await db.item.update({ where: { id: existing.id }, data: itemData(it, targetBusinessId, taxRateId) })
          bump('items', true)
        } else {
          bump('items', false)
        }
      } else {
        const created = await db.item.create({ data: itemData(it, targetBusinessId, taxRateId) })
        itemMap.set(String(it.id), created.id)
        bump('items', true)
      }
    } catch (e) {
      recordError('items', (e as Error).message, String(it.id || ''))
    }
  }

  // ----------------------------------------
  // 6. Bank accounts (by name)
  // ----------------------------------------
  for (const b of data.bankAccounts || []) {
    try {
      const name = String(b.name || '')
      const existing = await db.bankAccount.findFirst({ where: { businessId: targetBusinessId, name } })
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.bankAccount.update({ where: { id: existing.id }, data: bankAccountData(b, targetBusinessId) })
          bump('bankAccounts', true)
        } else {
          bump('bankAccounts', false)
        }
      } else {
        await db.bankAccount.create({ data: bankAccountData(b, targetBusinessId) })
        bump('bankAccounts', true)
      }
    } catch (e) {
      recordError('bankAccounts', (e as Error).message, String(b.id || ''))
    }
  }

  // ----------------------------------------
  // 7. Custom field definitions (by doctype + fieldKey)
  // ----------------------------------------
  for (const cf of data.customFields || []) {
    try {
      const doctype = String(cf.doctype || '')
      const fieldKey = String(cf.fieldKey || '')
      const existing = await db.customFieldDefinition.findUnique({
        where: { businessId_doctype_fieldKey: { businessId: targetBusinessId, doctype, fieldKey } },
      })
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.customFieldDefinition.update({ where: { id: existing.id }, data: customFieldData(cf, targetBusinessId) })
          bump('customFields', true)
        } else {
          bump('customFields', false)
        }
      } else {
        await db.customFieldDefinition.create({ data: customFieldData(cf, targetBusinessId) })
        bump('customFields', true)
      }
    } catch (e) {
      recordError('customFields', (e as Error).message, String(cf.id || ''))
    }
  }

  // ----------------------------------------
  // 8. PDF templates (by name)
  // ----------------------------------------
  for (const t of data.pdfTemplates || []) {
    try {
      const name = String(t.name || '')
      const existing = await db.pdfTemplate.findUnique({ where: { businessId_name: { businessId: targetBusinessId, name } } })
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.pdfTemplate.update({ where: { id: existing.id }, data: templateData(t, targetBusinessId) })
          bump('pdfTemplates', true)
        } else {
          bump('pdfTemplates', false)
        }
      } else {
        await db.pdfTemplate.create({ data: templateData(t, targetBusinessId) })
        bump('pdfTemplates', true)
      }
    } catch (e) {
      recordError('pdfTemplates', (e as Error).message, String(t.id || ''))
    }
  }

  // ----------------------------------------
  // 9. Journal entries (by number)
  // ----------------------------------------
  for (const j of data.journalEntries || []) {
    try {
      const number = String(j.number || '')
      const existing = await db.journalEntry.findUnique({ where: { businessId_number: { businessId: targetBusinessId, number } } })
      if (existing) {
        if (conflictResolution === 'overwrite') {
          // Replace lines
          await db.journalLine.deleteMany({ where: { journalEntryId: existing.id } })
          await db.journalEntry.update({ where: { id: existing.id }, data: journalEntryData(j, targetBusinessId, userId) })
          await createJournalLines(existing.id, j, accountMap, partyMap)
          bump('journalEntries', true)
        } else {
          bump('journalEntries', false)
        }
      } else {
        const created = await db.journalEntry.create({ data: journalEntryData(j, targetBusinessId, userId) })
        await createJournalLines(created.id, j, accountMap, partyMap)
        bump('journalEntries', true)
      }
    } catch (e) {
      recordError('journalEntries', (e as Error).message, String(j.id || ''))
    }
  }

  // ----------------------------------------
  // 10. Sales invoices (by number)
  // ----------------------------------------
  for (const inv of data.salesInvoices || []) {
    try {
      const number = String(inv.number || '')
      const existing = await db.salesInvoice.findUnique({ where: { businessId_number: { businessId: targetBusinessId, number } } })
      const partyId = resolveRef(inv.partyId, partyMap)
      if (!partyId) {
        recordError('salesInvoices', `Party not found for invoice ${number}`, String(inv.id || ''))
        continue
      }
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.salesInvoiceLine.deleteMany({ where: { invoiceId: existing.id } })
          await db.salesInvoice.update({ where: { id: existing.id }, data: invoiceData(inv, targetBusinessId, partyId, userId) })
          await createInvoiceLines('invoice', existing.id, inv, accountMap, itemMap, taxRateMap)
          bump('salesInvoices', true)
        } else {
          bump('salesInvoices', false)
        }
      } else {
        const created = await db.salesInvoice.create({ data: invoiceData(inv, targetBusinessId, partyId, userId) })
        await createInvoiceLines('invoice', created.id, inv, accountMap, itemMap, taxRateMap)
        bump('salesInvoices', true)
      }
    } catch (e) {
      recordError('salesInvoices', (e as Error).message, String(inv.id || ''))
    }
  }

  // ----------------------------------------
  // 11. Purchase bills (by number)
  // ----------------------------------------
  for (const bill of data.purchaseBills || []) {
    try {
      const number = String(bill.number || '')
      const existing = await db.purchaseBill.findUnique({ where: { businessId_number: { businessId: targetBusinessId, number } } })
      const partyId = resolveRef(bill.partyId, partyMap)
      if (!partyId) {
        recordError('purchaseBills', `Party not found for bill ${number}`, String(bill.id || ''))
        continue
      }
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.purchaseBillLine.deleteMany({ where: { billId: existing.id } })
          await db.purchaseBill.update({ where: { id: existing.id }, data: billData(bill, targetBusinessId, partyId, userId) })
          await createInvoiceLines('bill', existing.id, bill, accountMap, itemMap, taxRateMap)
          bump('purchaseBills', true)
        } else {
          bump('purchaseBills', false)
        }
      } else {
        const created = await db.purchaseBill.create({ data: billData(bill, targetBusinessId, partyId, userId) })
        await createInvoiceLines('bill', created.id, bill, accountMap, itemMap, taxRateMap)
        bump('purchaseBills', true)
      }
    } catch (e) {
      recordError('purchaseBills', (e as Error).message, String(bill.id || ''))
    }
  }

  // ----------------------------------------
  // 12. Quotations (by number)
  // ----------------------------------------
  for (const q of data.quotations || []) {
    try {
      const number = String(q.number || '')
      const existing = await db.quotation.findUnique({ where: { businessId_number: { businessId: targetBusinessId, number } } })
      const partyId = resolveRef(q.partyId, partyMap)
      if (!partyId) {
        recordError('quotations', `Party not found for quotation ${number}`, String(q.id || ''))
        continue
      }
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.quotationLine.deleteMany({ where: { quotationId: existing.id } })
          await db.quotation.update({ where: { id: existing.id }, data: quotationData(q, targetBusinessId, partyId) })
          await createInvoiceLines('quotation', existing.id, q, accountMap, itemMap, taxRateMap)
          bump('quotations', true)
        } else {
          bump('quotations', false)
        }
      } else {
        const created = await db.quotation.create({ data: quotationData(q, targetBusinessId, partyId) })
        await createInvoiceLines('quotation', created.id, q, accountMap, itemMap, taxRateMap)
        bump('quotations', true)
      }
    } catch (e) {
      recordError('quotations', (e as Error).message, String(q.id || ''))
    }
  }

  // ----------------------------------------
  // 13. Credit notes (by number)
  // ----------------------------------------
  for (const c of data.creditNotes || []) {
    try {
      const number = String(c.number || '')
      const existing = await db.creditNote.findUnique({ where: { businessId_number: { businessId: targetBusinessId, number } } })
      const partyId = resolveRef(c.partyId, partyMap)
      if (!partyId) {
        recordError('creditNotes', `Party not found for credit note ${number}`, String(c.id || ''))
        continue
      }
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.creditNoteLine.deleteMany({ where: { creditNoteId: existing.id } })
          await db.creditNote.update({ where: { id: existing.id }, data: creditNoteData(c, targetBusinessId, partyId) })
          await createInvoiceLines('creditNote', existing.id, c, accountMap, itemMap, taxRateMap)
          bump('creditNotes', true)
        } else {
          bump('creditNotes', false)
        }
      } else {
        const created = await db.creditNote.create({ data: creditNoteData(c, targetBusinessId, partyId) })
        await createInvoiceLines('creditNote', created.id, c, accountMap, itemMap, taxRateMap)
        bump('creditNotes', true)
      }
    } catch (e) {
      recordError('creditNotes', (e as Error).message, String(c.id || ''))
    }
  }

  // ----------------------------------------
  // 14. Delivery notes (by number)
  // ----------------------------------------
  for (const d of data.deliveryNotes || []) {
    try {
      const number = String(d.number || '')
      const existing = await db.deliveryNote.findUnique({ where: { businessId_number: { businessId: targetBusinessId, number } } })
      const partyId = resolveRef(d.partyId, partyMap)
      if (!partyId) {
        recordError('deliveryNotes', `Party not found for delivery note ${number}`, String(d.id || ''))
        continue
      }
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.deliveryNoteLine.deleteMany({ where: { deliveryNoteId: existing.id } })
          await db.deliveryNote.update({ where: { id: existing.id }, data: deliveryNoteData(d, targetBusinessId, partyId) })
          await createInvoiceLines('deliveryNote', existing.id, d, accountMap, itemMap, taxRateMap)
          bump('deliveryNotes', true)
        } else {
          bump('deliveryNotes', false)
        }
      } else {
        const created = await db.deliveryNote.create({ data: deliveryNoteData(d, targetBusinessId, partyId) })
        await createInvoiceLines('deliveryNote', created.id, d, accountMap, itemMap, taxRateMap)
        bump('deliveryNotes', true)
      }
    } catch (e) {
      recordError('deliveryNotes', (e as Error).message, String(d.id || ''))
    }
  }

  // ----------------------------------------
  // 15. Payments (by number)
  // ----------------------------------------
  for (const p of data.payments || []) {
    try {
      const number = String(p.number || '')
      const existing = await db.payment.findUnique({ where: { businessId_number: { businessId: targetBusinessId, number } } })
      const partyId = resolveRef(p.partyId, partyMap)
      if (!partyId) {
        recordError('payments', `Party not found for payment ${number}`, String(p.id || ''))
        continue
      }
      if (existing) {
        if (conflictResolution === 'overwrite') {
          await db.paymentAllocation.deleteMany({ where: { paymentId: existing.id } })
          await db.payment.update({ where: { id: existing.id }, data: paymentData(p, targetBusinessId, partyId, userId) })
          bump('payments', true)
        } else {
          bump('payments', false)
        }
      } else {
        const created = await db.payment.create({ data: paymentData(p, targetBusinessId, partyId, userId) })
        // Re-create allocations if present
        const allocs = (p as Record<string, unknown>)._allocations
        if (Array.isArray(allocs)) {
          for (const a of allocs as Record<string, unknown>[]) {
            try {
              await db.paymentAllocation.create({
                data: {
                  paymentId: created.id,
                  invoiceId: a.invoiceId ? await resolveInvoiceId(targetBusinessId, String(a.invoiceId)) : null,
                  billId: a.billId ? await resolveBillId(targetBusinessId, String(a.billId)) : null,
                  amount: Number(a.amount || 0),
                },
              })
            } catch {
              /* skip bad allocation */
            }
          }
        }
        bump('payments', true)
      }
    } catch (e) {
      recordError('payments', (e as Error).message, String(p.id || ''))
    }
  }

  return summary
}

// ============================================================
// IMPORT VALIDATION
// ============================================================

export function validateBackupPayload(payload: unknown): payload is BackupPayload {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>
  if (!p.meta || typeof p.meta !== 'object') return false
  if (!p.data || typeof p.data !== 'object') return false
  const data = p.data as Record<string, unknown>
  // Business backup should have at least a `business` key. Tenant/platform
  // backups are recognized via meta.scope.
  const meta = p.meta as Record<string, unknown>
  if (meta.scope === 'tenant') return Array.isArray(data.businesses)
  if (meta.scope === 'platform') return Array.isArray((data as Record<string, unknown>).tenants)
  // Default: business scope
  return 'business' in data
}

// ============================================================
// HELPERS — DATA SHAPERS
// ============================================================

function num(v: unknown, def = 0): number {
  if (v === null || v === undefined) return def
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return isNaN(n) ? def : n
}

function date(v: unknown): Date {
  if (!v) return new Date()
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? new Date() : d
}

function str(v: unknown, def = ''): string {
  return v === null || v === undefined ? def : String(v)
}

function maybeStr(v: unknown): string | null {
  return v === null || v === undefined || v === '' ? null : String(v)
}

function bool(v: unknown, def = false): boolean {
  return typeof v === 'boolean' ? v : def
}

function resolveRef(srcId: unknown, map: Map<string, string>): string | null {
  if (!srcId) return null
  return map.get(String(srcId)) || null
}

async function resolveInvoiceId(businessId: string, srcId: string): Promise<string | null> {
  // Try direct ID first
  const direct = await db.salesInvoice.findUnique({ where: { id: srcId } })
  if (direct && direct.businessId === businessId) return direct.id
  return null
}

async function resolveBillId(businessId: string, srcId: string): Promise<string | null> {
  const direct = await db.purchaseBill.findUnique({ where: { id: srcId } })
  if (direct && direct.businessId === businessId) return direct.id
  return null
}

function accountData(a: Record<string, unknown>, businessId: string) {
  return {
    businessId,
    code: str(a.code),
    name: str(a.name),
    nameAr: maybeStr(a.nameAr),
    type: str(a.type, 'ASSET'),
    subtype: maybeStr(a.subtype),
    parentId: null,
    description: maybeStr(a.description),
    isControl: bool(a.isControl),
    isSystem: bool(a.isSystem),
    isActive: bool(a.isActive, true),
    openingBalance: num(a.openingBalance),
  }
}

function partyData(p: Record<string, unknown>, businessId: string) {
  return {
    businessId,
    code: maybeStr(p.code),
    name: str(p.name),
    nameAr: maybeStr(p.nameAr),
    type: str(p.type, 'CUSTOMER'),
    trn: maybeStr(p.trn),
    email: maybeStr(p.email),
    phone: maybeStr(p.phone),
    website: maybeStr(p.website),
    contactPerson: maybeStr(p.contactPerson),
    billingAddress1: maybeStr(p.billingAddress1),
    billingAddress2: maybeStr(p.billingAddress2),
    billingCity: maybeStr(p.billingCity),
    billingState: maybeStr(p.billingState),
    billingPostalCode: maybeStr(p.billingPostalCode),
    billingCountry: str(p.billingCountry, 'AE'),
    shippingAddress1: maybeStr(p.shippingAddress1),
    shippingAddress2: maybeStr(p.shippingAddress2),
    shippingCity: maybeStr(p.shippingCity),
    shippingState: maybeStr(p.shippingState),
    shippingPostalCode: maybeStr(p.shippingPostalCode),
    shippingCountry: str(p.shippingCountry, 'AE'),
    paymentTerms: num(p.paymentTerms, 30),
    creditLimit: num(p.creditLimit),
    openingBalance: num(p.openingBalance),
    openingBalanceType: str(p.openingBalanceType, 'DEBIT'),
    notes: maybeStr(p.notes),
    isActive: bool(p.isActive, true),
    customFields: maybeStr(p.customFields),
  }
}

function taxRateData(t: Record<string, unknown>, businessId: string) {
  return {
    businessId,
    name: str(t.name),
    nameAr: maybeStr(t.nameAr),
    rate: num(t.rate),
    category: str(t.category, 'STANDARD_RATED'),
    isDefault: bool(t.isDefault),
    isActive: bool(t.isActive, true),
  }
}

function currencyData(c: Record<string, unknown>, businessId: string) {
  return {
    businessId,
    code: str(c.code),
    name: str(c.name),
    symbol: str(c.symbol),
    isBase: bool(c.isBase),
    exchangeRate: num(c.exchangeRate, 1),
  }
}

function itemData(it: Record<string, unknown>, businessId: string, taxRateId: string | null) {
  return {
    businessId,
    sku: str(it.sku),
    name: str(it.name),
    nameAr: maybeStr(it.nameAr),
    description: maybeStr(it.description),
    unit: str(it.unit, 'PCS'),
    category: maybeStr(it.category),
    salePrice: num(it.salePrice),
    purchasePrice: num(it.purchasePrice),
    costMethod: str(it.costMethod, 'WEIGHTED_AVG'),
    stockQty: num(it.stockQty),
    reorderLevel: num(it.reorderLevel),
    taxRateId,
    isInventory: bool(it.isInventory, true),
    isActive: bool(it.isActive, true),
    customFields: maybeStr(it.customFields),
  }
}

function bankAccountData(b: Record<string, unknown>, businessId: string) {
  return {
    businessId,
    name: str(b.name),
    accountNumber: maybeStr(b.accountNumber),
    bankName: maybeStr(b.bankName),
    branch: maybeStr(b.branch),
    iban: maybeStr(b.iban),
    openingBalance: num(b.openingBalance),
    currentBalance: num(b.currentBalance),
    currency: str(b.currency, 'AED'),
    isActive: bool(b.isActive, true),
  }
}

function customFieldData(cf: Record<string, unknown>, businessId: string) {
  return {
    businessId,
    doctype: str(cf.doctype),
    tab: str(cf.tab, 'General'),
    section: str(cf.section, 'Details'),
    fieldKey: str(cf.fieldKey),
    label: str(cf.label),
    labelAr: maybeStr(cf.labelAr),
    type: str(cf.type, 'TEXT'),
    options: maybeStr(cf.options),
    defaultValue: maybeStr(cf.defaultValue),
    isRequired: bool(cf.isRequired),
    isVisible: bool(cf.isVisible, true),
    position: num(cf.position),
  }
}

function templateData(t: Record<string, unknown>, businessId: string) {
  return {
    businessId,
    name: str(t.name),
    doctype: str(t.doctype),
    htmlContent: str(t.htmlContent),
    cssContent: str(t.cssContent),
    isDefault: bool(t.isDefault),
    isSystem: bool(t.isSystem),
  }
}

function journalEntryData(j: Record<string, unknown>, businessId: string, userId: string) {
  return {
    businessId,
    number: str(j.number),
    date: date(j.date),
    reference: maybeStr(j.reference),
    description: maybeStr(j.description),
    sourceType: maybeStr(j.sourceType),
    sourceId: maybeStr(j.sourceId),
    isPosted: bool(j.isPosted),
    postedAt: j.postedAt ? date(j.postedAt) : null,
    isReversed: bool(j.isReversed),
    reversedById: maybeStr(j.reversedById),
    createdById: userId,
  }
}

async function createJournalLines(
  journalEntryId: string,
  j: Record<string, unknown>,
  accountMap: Map<string, string>,
  partyMap: Map<string, string>
) {
  const lines = (j._lines || j.lines) as Record<string, unknown>[] | undefined
  if (!Array.isArray(lines)) return
  for (const l of lines) {
    const accountId = resolveRef(l.accountId, accountMap)
    if (!accountId) continue
    const partyId = l.partyId ? resolveRef(l.partyId, partyMap) : null
    try {
      await db.journalLine.create({
        data: {
          journalEntryId,
          accountId,
          debit: num(l.debit),
          credit: num(l.credit),
          description: maybeStr(l.description),
          partyId,
        },
      })
    } catch {
      /* skip bad line */
    }
  }
}

function invoiceData(inv: Record<string, unknown>, businessId: string, partyId: string, userId: string) {
  return {
    businessId,
    number: str(inv.number),
    date: date(inv.date),
    dueDate: date(inv.dueDate),
    partyId,
    reference: maybeStr(inv.reference),
    currency: str(inv.currency, 'AED'),
    exchangeRate: num(inv.exchangeRate, 1),
    subtotal: num(inv.subtotal),
    totalDiscount: num(inv.totalDiscount),
    totalTax: num(inv.totalTax),
    total: num(inv.total),
    amountPaid: num(inv.amountPaid),
    status: str(inv.status, 'DRAFT'),
    notes: maybeStr(inv.notes),
    terms: maybeStr(inv.terms),
    customFields: maybeStr(inv.customFields),
    einvoiceUuid: maybeStr(inv.einvoiceUuid),
    einvoiceXml: maybeStr(inv.einvoiceXml),
    postedAt: inv.postedAt ? date(inv.postedAt) : null,
    createdById: userId,
  }
}

function billData(b: Record<string, unknown>, businessId: string, partyId: string, userId: string) {
  return {
    businessId,
    number: str(b.number),
    date: date(b.date),
    dueDate: date(b.dueDate),
    partyId,
    supplierInvoiceNumber: maybeStr(b.supplierInvoiceNumber),
    reference: maybeStr(b.reference),
    currency: str(b.currency, 'AED'),
    exchangeRate: num(b.exchangeRate, 1),
    subtotal: num(b.subtotal),
    totalDiscount: num(b.totalDiscount),
    totalTax: num(b.totalTax),
    total: num(b.total),
    amountPaid: num(b.amountPaid),
    status: str(b.status, 'DRAFT'),
    notes: maybeStr(b.notes),
    customFields: maybeStr(b.customFields),
    postedAt: b.postedAt ? date(b.postedAt) : null,
    createdById: userId,
  }
}

function quotationData(q: Record<string, unknown>, businessId: string, partyId: string) {
  return {
    businessId,
    number: str(q.number),
    date: date(q.date),
    validUntil: q.validUntil ? date(q.validUntil) : null,
    partyId,
    reference: maybeStr(q.reference),
    currency: str(q.currency, 'AED'),
    subtotal: num(q.subtotal),
    totalDiscount: num(q.totalDiscount),
    totalTax: num(q.totalTax),
    total: num(q.total),
    status: str(q.status, 'DRAFT'),
    notes: maybeStr(q.notes),
    terms: maybeStr(q.terms),
    customFields: maybeStr(q.customFields),
  }
}

function creditNoteData(c: Record<string, unknown>, businessId: string, partyId: string) {
  return {
    businessId,
    number: str(c.number),
    date: date(c.date),
    partyId,
    originalInvoiceId: maybeStr(c.originalInvoiceId),
    reference: maybeStr(c.reference),
    currency: str(c.currency, 'AED'),
    subtotal: num(c.subtotal),
    totalTax: num(c.totalTax),
    total: num(c.total),
    status: str(c.status, 'DRAFT'),
    reason: maybeStr(c.reason),
    notes: maybeStr(c.notes),
    customFields: maybeStr(c.customFields),
    postedAt: c.postedAt ? date(c.postedAt) : null,
  }
}

function deliveryNoteData(d: Record<string, unknown>, businessId: string, partyId: string) {
  return {
    businessId,
    number: str(d.number),
    date: date(d.date),
    partyId,
    invoiceId: maybeStr(d.invoiceId),
    reference: maybeStr(d.reference),
    status: str(d.status, 'DRAFT'),
    notes: maybeStr(d.notes),
    customFields: maybeStr(d.customFields),
  }
}

function paymentData(p: Record<string, unknown>, businessId: string, partyId: string, userId: string) {
  return {
    businessId,
    number: str(p.number),
    date: date(p.date),
    type: str(p.type, 'RECEIPT'),
    partyId,
    amount: num(p.amount),
    currency: str(p.currency, 'AED'),
    exchangeRate: num(p.exchangeRate, 1),
    method: str(p.method, 'CASH'),
    reference: maybeStr(p.reference),
    bankAccountId: maybeStr(p.bankAccountId),
    description: maybeStr(p.description),
    status: str(p.status, 'POSTED'),
    customFields: maybeStr(p.customFields),
    createdById: userId,
  }
}

// Map a doc-type key to the right Prisma line model + parent field
async function createInvoiceLines(
  kind: 'invoice' | 'bill' | 'quotation' | 'creditNote' | 'deliveryNote',
  parentId: string,
  doc: Record<string, unknown>,
  _accountMap: Map<string, string>,
  itemMap: Map<string, string>,
  taxRateMap: Map<string, string>
) {
  const lines = (doc._lines || doc.lines) as Record<string, unknown>[] | undefined
  if (!Array.isArray(lines)) return
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const itemId = l.itemId ? resolveRef(l.itemId, itemMap) : null
    const taxRateId = l.taxRateId ? resolveRef(l.taxRateId, taxRateMap) : null
    const base = {
      description: str(l.description),
      quantity: num(l.quantity),
      unitPrice: num(l.unitPrice),
      discount: num(l.discount),
      position: num(l.position, i),
      taxRateId,
    }
    try {
      switch (kind) {
        case 'invoice':
          await db.salesInvoiceLine.create({
            data: { ...base, invoiceId: parentId, itemId, lineTotal: num(l.lineTotal), lineTax: num(l.lineTax) },
          })
          break
        case 'bill':
          await db.purchaseBillLine.create({
            data: { ...base, billId: parentId, itemId, lineTotal: num(l.lineTotal), lineTax: num(l.lineTax) },
          })
          break
        case 'quotation':
          await db.quotationLine.create({
            data: { ...base, quotationId: parentId, itemId, lineTotal: num(l.lineTotal), lineTax: num(l.lineTax) },
          })
          break
        case 'creditNote':
          await db.creditNoteLine.create({
            data: {
              description: str(l.description),
              quantity: num(l.quantity),
              unitPrice: num(l.unitPrice),
              position: num(l.position, i),
              taxRateId,
              creditNoteId: parentId,
              lineTotal: num(l.lineTotal),
              lineTax: num(l.lineTax),
            },
          })
          break
        case 'deliveryNote':
          await db.deliveryNoteLine.create({
            data: {
              description: str(l.description),
              quantity: num(l.quantity),
              position: num(l.position, i),
              itemId,
              deliveryNoteId: parentId,
            },
          })
          break
      }
    } catch {
      /* skip bad line */
    }
  }
}
