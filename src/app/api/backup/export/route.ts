import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId, getSession, AuthError } from '@/lib/auth'
import { setBusinessSetting } from '@/lib/settings'

// POST /api/backup/export — export the current business's data as JSON
// Returns a JSON blob containing all business-scoped records.
export async function POST() {
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

  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const [
    accounts,
    parties,
    invoices,
    bills,
    payments,
    quotations,
    creditNotes,
    deliveryNotes,
    items,
    journalEntries,
    bankAccounts,
    bankTransactions,
    taxRates,
    currencies,
    customFields,
    pdfTemplates,
  ] = await Promise.all([
    db.account.findMany({ where: { businessId } }),
    db.party.findMany({ where: { businessId } }),
    db.salesInvoice.findMany({ where: { businessId }, include: { lines: true } }),
    db.purchaseBill.findMany({ where: { businessId }, include: { lines: true } }),
    db.payment.findMany({ where: { businessId }, include: { allocations: true } }),
    db.quotation.findMany({ where: { businessId }, include: { lines: true } }),
    db.creditNote.findMany({ where: { businessId }, include: { lines: true } }),
    db.deliveryNote.findMany({ where: { businessId }, include: { lines: true } }),
    db.item.findMany({ where: { businessId } }),
    db.journalEntry.findMany({
      where: { businessId },
      include: { lines: { include: { account: { select: { code: true, name: true } } } } },
    }),
    db.bankAccount.findMany({ where: { businessId } }),
    db.bankTransaction.findMany({ where: { bankAccount: { businessId } } }),
    db.taxRate.findMany({ where: { businessId } }),
    db.currency.findMany({ where: { businessId } }),
    db.customFieldDefinition.findMany({ where: { businessId } }),
    db.pdfTemplate.findMany({ where: { businessId } }),
  ])

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    business: {
      ...business,
      vatRate: Number(business.vatRate),
    },
    tenantId,
    exportedBy: session?.userId || null,
    data: {
      accounts,
      parties,
      invoices,
      bills,
      payments,
      quotations,
      creditNotes,
      deliveryNotes,
      items,
      journalEntries,
      bankAccounts,
      bankTransactions,
      taxRates,
      currencies,
      customFields,
      pdfTemplates,
    },
    summary: {
      accounts: accounts.length,
      parties: parties.length,
      invoices: invoices.length,
      bills: bills.length,
      payments: payments.length,
      quotations: quotations.length,
      creditNotes: creditNotes.length,
      deliveryNotes: deliveryNotes.length,
      items: items.length,
      journalEntries: journalEntries.length,
      bankAccounts: bankAccounts.length,
      bankTransactions: bankTransactions.length,
      taxRates: taxRates.length,
      currencies: currencies.length,
      customFields: customFields.length,
      pdfTemplates: pdfTemplates.length,
    },
  }

  const records = Object.values(payload.summary).reduce((s, n) => s + n, 0)
  const sizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8')

  // Record the last backup metadata
  await setBusinessSetting(businessId, 'last_backup', {
    at: payload.exportedAt,
    size: sizeBytes,
    records,
  })

  // Audit log (best-effort)
  if (tenantId && session?.userId) {
    await db.auditLog
      .create({
        data: {
          businessId,
          tenantId,
          userId: session.userId,
          action: 'BACKUP_EXPORT',
          entityType: 'BUSINESS',
          entityId: businessId,
          description: `Exported backup with ${records} records (${sizeBytes} bytes)`,
        },
      })
      .catch(() => {})
  }

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': `attachment; filename="backup-${business.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.json"`,
    },
  })
}
