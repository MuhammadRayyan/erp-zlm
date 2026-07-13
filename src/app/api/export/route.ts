import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { toNumber } from '@/lib/decimal'

// GET /api/export?entity=invoices|bills|customers|suppliers|items|accounts|journal|payments
// Returns a CSV file.
export async function GET(req: NextRequest) {
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
  const entity = searchParams.get('entity') || 'invoices'

  // CSV helper — escapes quotes/commas/newlines per RFC 4180
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'string' ? v : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const toCsv = (rows: Record<string, unknown>[]): string => {
    if (rows.length === 0) return ''
    const cols = Object.keys(rows[0])
    const header = cols.join(',')
    const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n')
    return `${header}\n${body}`
  }

  let csv = ''
  let filename = `${entity}-${Date.now()}.csv`

  switch (entity) {
    case 'invoices': {
      const rows = await db.salesInvoice.findMany({
        where: { businessId },
        include: { party: { select: { name: true } } },
        orderBy: { date: 'desc' },
      })
      csv = toCsv(
        rows.map(r => ({
          number: r.number,
          date: r.date.toISOString().slice(0, 10),
          dueDate: r.dueDate.toISOString().slice(0, 10),
          party: r.party.name,
          reference: r.reference || '',
          currency: r.currency,
          subtotal: toNumber(r.subtotal),
          totalDiscount: toNumber(r.totalDiscount),
          totalTax: toNumber(r.totalTax),
          total: toNumber(r.total),
          amountPaid: toNumber(r.amountPaid),
          balanceDue: toNumber(r.total) - toNumber(r.amountPaid),
          status: r.status,
        }))
      )
      break
    }
    case 'bills': {
      const rows = await db.purchaseBill.findMany({
        where: { businessId },
        include: { party: { select: { name: true } } },
        orderBy: { date: 'desc' },
      })
      csv = toCsv(
        rows.map(r => ({
          number: r.number,
          date: r.date.toISOString().slice(0, 10),
          dueDate: r.dueDate.toISOString().slice(0, 10),
          supplier: r.party.name,
          supplierInvoiceNumber: r.supplierInvoiceNumber || '',
          reference: r.reference || '',
          currency: r.currency,
          subtotal: toNumber(r.subtotal),
          totalDiscount: toNumber(r.totalDiscount),
          totalTax: toNumber(r.totalTax),
          total: toNumber(r.total),
          amountPaid: toNumber(r.amountPaid),
          balanceDue: toNumber(r.total) - toNumber(r.amountPaid),
          status: r.status,
        }))
      )
      break
    }
    case 'customers':
    case 'suppliers': {
      const type = entity === 'customers' ? 'CUSTOMER' : 'SUPPLIER'
      const rows = await db.party.findMany({
        where: { businessId, type: { in: [type, 'BOTH'] } },
        orderBy: { name: 'asc' },
      })
      csv = toCsv(
        rows.map(p => ({
          code: p.code || '',
          name: p.name,
          trn: p.trn || '',
          email: p.email || '',
          phone: p.phone || '',
          contactPerson: p.contactPerson || '',
          city: p.billingCity || '',
          state: p.billingState || '',
          country: p.billingCountry,
          paymentTerms: p.paymentTerms,
          creditLimit: toNumber(p.creditLimit),
          openingBalance: toNumber(p.openingBalance),
          isActive: p.isActive,
        }))
      )
      break
    }
    case 'items': {
      const rows = await db.item.findMany({ where: { businessId }, orderBy: { name: 'asc' } })
      csv = toCsv(
        rows.map(i => ({
          sku: i.sku,
          name: i.name,
          category: i.category || '',
          unit: i.unit,
          salePrice: toNumber(i.salePrice),
          purchasePrice: toNumber(i.purchasePrice),
          stockQty: toNumber(i.stockQty),
          reorderLevel: toNumber(i.reorderLevel),
          isInventory: i.isInventory,
          isActive: i.isActive,
        }))
      )
      break
    }
    case 'accounts': {
      const rows = await db.account.findMany({ where: { businessId }, orderBy: { code: 'asc' } })
      csv = toCsv(
        rows.map(a => ({
          code: a.code,
          name: a.name,
          type: a.type,
          subtype: a.subtype || '',
          openingBalance: toNumber(a.openingBalance),
          isControl: a.isControl,
          isSystem: a.isSystem,
          isActive: a.isActive,
        }))
      )
      break
    }
    case 'journal': {
      const rows = await db.journalEntry.findMany({
        where: { businessId },
        include: { lines: { include: { account: { select: { code: true, name: true } } } } },
        orderBy: { date: 'desc' },
      })
      const flat: Record<string, unknown>[] = []
      for (const je of rows) {
        for (const l of je.lines) {
          flat.push({
            number: je.number,
            date: je.date.toISOString().slice(0, 10),
            reference: je.reference || '',
            description: je.description || '',
            accountCode: l.account.code,
            accountName: l.account.name,
            debit: toNumber(l.debit),
            credit: toNumber(l.credit),
            lineDescription: l.description || '',
            isPosted: je.isPosted,
            sourceType: je.sourceType || '',
          })
        }
      }
      csv = toCsv(flat)
      break
    }
    case 'payments': {
      const rows = await db.payment.findMany({
        where: { businessId },
        include: { party: { select: { name: true } } },
        orderBy: { date: 'desc' },
      })
      csv = toCsv(
        rows.map(p => ({
          number: p.number,
          date: p.date.toISOString().slice(0, 10),
          type: p.type,
          party: p.party.name,
          amount: toNumber(p.amount),
          currency: p.currency,
          method: p.method,
          reference: p.reference || '',
          description: p.description || '',
          status: p.status,
        }))
      )
      break
    }
    default:
      return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 })
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
