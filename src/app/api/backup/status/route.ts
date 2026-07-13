import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { getBusinessSetting } from '@/lib/settings'

// GET /api/backup/status — record counts, estimated data size, last backup date
export async function GET() {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

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
    db.account.count({ where: { businessId } }),
    db.party.count({ where: { businessId } }),
    db.salesInvoice.count({ where: { businessId } }),
    db.purchaseBill.count({ where: { businessId } }),
    db.payment.count({ where: { businessId } }),
    db.quotation.count({ where: { businessId } }),
    db.creditNote.count({ where: { businessId } }),
    db.deliveryNote.count({ where: { businessId } }),
    db.item.count({ where: { businessId } }),
    db.journalEntry.count({ where: { businessId } }),
    db.bankAccount.count({ where: { businessId } }),
    db.bankTransaction.count({ where: { bankAccount: { businessId } } }),
    db.taxRate.count({ where: { businessId } }),
    db.currency.count({ where: { businessId } }),
    db.customFieldDefinition.count({ where: { businessId } }),
    db.pdfTemplate.count({ where: { businessId } }),
  ])

  const counts = {
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
  }

  const totalRecords = Object.values(counts).reduce((s, n) => s + n, 0)
  // Rough estimate: ~2KB per record (varies, but a sensible conservative default)
  const estimatedSizeBytes = totalRecords * 2048

  const lastBackup = await getBusinessSetting<{ at: string; size: number; records: number }>(
    businessId,
    'last_backup'
  )

  return NextResponse.json({
    businessId,
    counts,
    totalRecords,
    estimatedSizeBytes,
    estimatedSizeMB: Math.round((estimatedSizeBytes / (1024 * 1024)) * 100) / 100,
    lastBackup: lastBackup
      ? {
          at: lastBackup.at,
          size: lastBackup.size,
          records: lastBackup.records,
        }
      : null,
  })
}
