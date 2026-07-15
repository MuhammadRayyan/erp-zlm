import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ensureBusinessId,
  getCurrentTenantId,
  getSession,
  AuthError,
} from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'
import { postJournalEntry } from '@/lib/journal-service'
import {
  calculateLine,
  calculateDocumentTotals,
  generateEInvoiceUuid,
} from '@/lib/vat-service'
type RecurringSchedule = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
type RecurringType = 'INVOICE' | 'BILL' | 'JOURNAL' | 'PAYMENT'

interface RecurringTransaction {
  id: string
  name: string
  type: RecurringType
  schedule: RecurringSchedule
  startDate: string
  nextRunAt: string
  endDate?: string
  lastRunAt?: string
  partyId?: string
  amount?: number
  description?: string
  reference?: string
  lines?: Array<{ description: string; quantity: number; unitPrice: number; discount?: number; taxRateId?: string }>
  journalLines?: Array<{ accountId: string; debit: number; credit: number; description?: string }>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const NAMESPACE = 'recurring_transactions'

// Compute the next run date given a schedule and a "from" date.
function computeNextRun(from: Date, schedule: RecurringSchedule): Date {
  const next = new Date(from)
  switch (schedule) {
    case 'DAILY':
      next.setDate(next.getDate() + 1)
      break
    case 'WEEKLY':
      next.setDate(next.getDate() + 7)
      break
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1)
      break
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3)
      break
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1)
      break
  }
  return next
}

// POST /api/recurring/run?id=xxx — manually trigger a recurring transaction
// Body: { id: string } OR query param ?id=xxx
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

  const { searchParams } = new URL(req.url)
  const body = await req.json().catch(() => ({}))
  const id = searchParams.get('id') || body.id
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const items =
    (await getBusinessSetting<RecurringTransaction[]>(businessId, NAMESPACE)) || []
  const rct = items.find(i => i.id === id)
  if (!rct) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const userId = session.userId

  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const now = new Date()
  let result: { type: string; id?: string; number?: string } = { type: rct.type }

  try {
    switch (rct.type) {
      case 'INVOICE': {
        if (!rct.partyId || !rct.lines?.length) {
          return NextResponse.json(
            { error: 'Recurring invoice requires partyId and lines' },
            { status: 400 }
          )
        }
        // Pre-fetch tax rates referenced by the lines so we can compute
        // totals synchronously (calculateDocumentTotals is sync).
        const taxRateIds = rct.lines
          .map(l => l.taxRateId)
          .filter((id): id is string => !!id)
        const taxRates =
          taxRateIds.length > 0
            ? await db.taxRate.findMany({ where: { id: { in: taxRateIds } } })
            : []
        const taxRateMap = new Map(taxRates.map(t => [t.id, Number(t.rate)]))

        const lineInputs = rct.lines.map(l => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount || 0,
          taxRate: l.taxRateId
            ? taxRateMap.get(l.taxRateId) ?? 0
            : business.vatRegistered
              ? Number(business.vatRate)
              : 0,
          taxCategory: 'STANDARD_RATED' as const,
        }))
        const totals = calculateDocumentTotals(lineInputs)
        const number = `${business.invoicePrefix}${String(business.nextInvoiceNumber).padStart(6, '0')}`

        const invoice = await db.salesInvoice.create({
          data: {
            businessId,
            number,
            date: now,
            dueDate: new Date(now.getTime() + (business ? 30 * 86400000 : 0)),
            partyId: rct.partyId,
            reference: rct.reference || null,
            currency: business.baseCurrency,
            subtotal: totals.subtotal,
            totalDiscount: totals.totalDiscount,
            totalTax: totals.totalTax,
            total: totals.total,
            amountPaid: 0,
            status: 'POSTED',
            einvoiceUuid: generateEInvoiceUuid(),
            postedAt: now,
            createdById: userId,
            lines: {
              create: rct.lines.map((l, i) => {
                const calc = calculateLine({
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discount: l.discount || 0,
                  taxRate: lineInputs[i].taxRate,
                })
                return {
                  description: l.description,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discount: l.discount || 0,
                  position: i,
                  taxRateId: l.taxRateId || null,
                  lineTotal: calc.netAmount,
                  lineTax: calc.taxAmount,
                }
              }),
            },
          },
        })

        // Post journal entry
        const arAccount = await db.account.findFirst({
          where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' },
        })
        const salesAccount = await db.account.findFirst({
          where: { businessId, subtype: 'SALES' },
        })
        const vatOutputAccount = await db.account.findFirst({
          where: { businessId, code: '2220' },
        })
        if (arAccount && salesAccount) {
          await postJournalEntry({
            businessId,
            userId,
            date: now,
            reference: `Recurring invoice ${number}`,
            description: `Recurring sales invoice ${number}`,
            sourceType: 'SALES_INVOICE',
            sourceId: invoice.id,
            lines: [
              { accountId: arAccount.id, debit: totals.total, credit: 0, partyId: rct.partyId },
              { accountId: salesAccount.id, debit: 0, credit: totals.subtotal },
              ...(vatOutputAccount && totals.totalTax > 0
                ? [{ accountId: vatOutputAccount.id, debit: 0, credit: totals.totalTax }]
                : []),
            ],
          })
        }

        await db.business.update({
          where: { id: businessId },
          data: { nextInvoiceNumber: { increment: 1 } },
        })
        result = { type: 'INVOICE', id: invoice.id, number }
        break
      }
      case 'JOURNAL': {
        if (!rct.journalLines?.length || rct.journalLines.length < 2) {
          return NextResponse.json(
            { error: 'Recurring journal requires at least 2 lines' },
            { status: 400 }
          )
        }
        const entryId = await postJournalEntry({
          businessId,
          userId,
          date: now,
          reference: rct.reference || `Recurring ${rct.name}`,
          description: rct.description || `Recurring journal entry: ${rct.name}`,
          sourceType: 'RECURRING',
          sourceId: rct.id,
          lines: rct.journalLines.map(l => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        })
        const entry = await db.journalEntry.findFirst({ where: { id: entryId, businessId } })
        result = { type: 'JOURNAL', id: entryId, number: entry?.number }
        break
      }
      case 'PAYMENT': {
        if (!rct.partyId || !rct.amount) {
          return NextResponse.json(
            { error: 'Recurring payment requires partyId and amount' },
            { status: 400 }
          )
        }
        const number = `${business.paymentPrefix}${String(business.nextPaymentNumber).padStart(6, '0')}`
        const payment = await db.payment.create({
          data: {
            businessId,
            number,
            date: now,
            type: 'PAYMENT',
            partyId: rct.partyId,
            amount: rct.amount,
            currency: business.baseCurrency,
            method: 'BANK_TRANSFER',
            reference: rct.reference || null,
            description: rct.description || `Recurring payment: ${rct.name}`,
            status: 'POSTED',
            createdById: userId,
          },
        })
        await db.business.update({
          where: { id: businessId },
          data: { nextPaymentNumber: { increment: 1 } },
        })
        result = { type: 'PAYMENT', id: payment.id, number }
        break
      }
      case 'BILL': {
        if (!rct.partyId || !rct.lines?.length) {
          return NextResponse.json(
            { error: 'Recurring bill requires partyId and lines' },
            { status: 400 }
          )
        }
        const lineInputs = rct.lines.map(l => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount || 0,
          taxRate: business.vatRegistered ? Number(business.vatRate) : 0,
          taxCategory: 'STANDARD_RATED' as const,
        }))
        const totals = calculateDocumentTotals(lineInputs)
        const number = `${business.billPrefix}${String(business.nextBillNumber).padStart(6, '0')}`
        const bill = await db.purchaseBill.create({
          data: {
            businessId,
            number,
            date: now,
            dueDate: new Date(now.getTime() + 30 * 86400000),
            partyId: rct.partyId,
            reference: rct.reference || null,
            currency: business.baseCurrency,
            subtotal: totals.subtotal,
            totalDiscount: totals.totalDiscount,
            totalTax: totals.totalTax,
            total: totals.total,
            amountPaid: 0,
            status: 'POSTED',
            postedAt: now,
            createdById: userId,
            lines: {
              create: rct.lines.map((l, i) => {
                const calc = calculateLine({
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discount: l.discount || 0,
                  taxRate: lineInputs[i].taxRate,
                })
                return {
                  description: l.description,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice,
                  discount: l.discount || 0,
                  position: i,
                  taxRateId: l.taxRateId || null,
                  lineTotal: calc.netAmount,
                  lineTax: calc.taxAmount,
                }
              }),
            },
          },
        })
        await db.business.update({
          where: { id: businessId },
          data: { nextBillNumber: { increment: 1 } },
        })
        result = { type: 'BILL', id: bill.id, number }
        break
      }
      default:
        return NextResponse.json({ error: `Unknown recurring type: ${rct.type}` }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to run recurring transaction: ${(e as Error).message}` },
      { status: 500 }
    )
  }

  // Update the recurring template — set lastRunAt and advance nextRunAt
  const updatedItems = items.map(i => {
    if (i.id !== rct.id) return i
    const nextRun = computeNextRun(now, i.schedule)
    return { ...i, lastRunAt: now.toISOString(), nextRunAt: nextRun.toISOString() }
  })
  await setBusinessSetting(businessId, NAMESPACE, updatedItems)

  // Audit log
  const tenantId = await getCurrentTenantId()
  if (tenantId) {
    await db.auditLog
      .create({
        data: {
          businessId,
          tenantId,
          userId,
          action: 'RECURRING_RUN',
          entityType: 'RECURRING_TRANSACTION',
          entityId: rct.id,
          description: `Manually triggered recurring ${rct.type} "${rct.name}" → ${result.type} ${result.number || result.id || ''}`.trim(),
        },
      })
      .catch(() => {})
  }

  return NextResponse.json({ ok: true, result, runAt: now.toISOString() })
}
