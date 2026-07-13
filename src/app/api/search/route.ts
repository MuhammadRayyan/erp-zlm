import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { toNumber } from '@/lib/decimal'

interface SearchResult {
  type: 'invoice' | 'bill' | 'party' | 'item' | 'account' | 'payment' | 'quotation' | 'credit-note'
  id: string
  label: string
  description?: string
  href?: string
  meta?: Record<string, unknown>
}

// GET /api/search?q=...&limit=20
// Global search across invoices, parties, items, accounts (and a few extras).
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
  const q = (searchParams.get('q') || '').trim()
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100)

  if (!q) {
    return NextResponse.json({ items: [], query: q })
  }

  const results: SearchResult[] = []

  // Run searches in parallel
  const [invoices, bills, parties, items, accounts, payments, quotations, creditNotes] =
    await Promise.all([
      db.salesInvoice.findMany({
        where: {
          businessId,
          OR: [
            { number: { contains: q } },
            { reference: { contains: q } },
            { party: { name: { contains: q } } },
          ],
        },
        include: { party: { select: { name: true } } },
        take: limit,
      }),
      db.purchaseBill.findMany({
        where: {
          businessId,
          OR: [
            { number: { contains: q } },
            { supplierInvoiceNumber: { contains: q } },
            { reference: { contains: q } },
            { party: { name: { contains: q } } },
          ],
        },
        include: { party: { select: { name: true } } },
        take: limit,
      }),
      db.party.findMany({
        where: {
          businessId,
          OR: [
            { name: { contains: q } },
            { code: { contains: q } },
            { trn: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        take: limit,
      }),
      db.item.findMany({
        where: {
          businessId,
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { category: { contains: q } },
          ],
        },
        take: limit,
      }),
      db.account.findMany({
        where: {
          businessId,
          OR: [{ code: { contains: q } }, { name: { contains: q } }],
        },
        take: limit,
      }),
      db.payment.findMany({
        where: {
          businessId,
          OR: [
            { number: { contains: q } },
            { reference: { contains: q } },
            { party: { name: { contains: q } } },
          ],
        },
        include: { party: { select: { name: true } } },
        take: limit,
      }),
      db.quotation.findMany({
        where: {
          businessId,
          OR: [
            { number: { contains: q } },
            { reference: { contains: q } },
            { party: { name: { contains: q } } },
          ],
        },
        include: { party: { select: { name: true } } },
        take: limit,
      }),
      db.creditNote.findMany({
        where: {
          businessId,
          OR: [
            { number: { contains: q } },
            { reference: { contains: q } },
            { party: { name: { contains: q } } },
          ],
        },
        include: { party: { select: { name: true } } },
        take: limit,
      }),
    ])

  for (const inv of invoices) {
    results.push({
      type: 'invoice',
      id: inv.id,
      label: inv.number,
      description: `${inv.party.name} • ${inv.status}`,
      href: `/?m=invoices&id=${inv.id}`,
      meta: { date: inv.date, total: toNumber(inv.total), status: inv.status, partyId: inv.partyId },
    })
  }
  for (const b of bills) {
    results.push({
      type: 'bill',
      id: b.id,
      label: b.number,
      description: `${b.party.name} • ${b.status}`,
      href: `/?m=bills&id=${b.id}`,
      meta: { date: b.date, total: toNumber(b.total), status: b.status, partyId: b.partyId },
    })
  }
  for (const p of parties) {
    results.push({
      type: 'party',
      id: p.id,
      label: p.name,
      description: `${p.type}${p.trn ? ` • TRN ${p.trn}` : ''}`,
      href: `/?m=${p.type === 'SUPPLIER' ? 'suppliers' : 'customers'}&id=${p.id}`,
      meta: { code: p.code, trn: p.trn, email: p.email },
    })
  }
  for (const it of items) {
    results.push({
      type: 'item',
      id: it.id,
      label: it.name,
      description: `SKU ${it.sku}${it.category ? ` • ${it.category}` : ''}`,
      href: `/?m=items&id=${it.id}`,
      meta: { sku: it.sku, salePrice: toNumber(it.salePrice), stockQty: toNumber(it.stockQty) },
    })
  }
  for (const a of accounts) {
    results.push({
      type: 'account',
      id: a.id,
      label: `${a.code} — ${a.name}`,
      description: a.type + (a.subtype ? ` • ${a.subtype}` : ''),
      href: `/?m=accounts&id=${a.id}`,
      meta: { code: a.code, type: a.type, subtype: a.subtype },
    })
  }
  for (const pmt of payments) {
    results.push({
      type: 'payment',
      id: pmt.id,
      label: pmt.number,
      description: `${pmt.type} • ${pmt.party.name}`,
      href: `/?m=payments&id=${pmt.id}`,
      meta: { date: pmt.date, amount: toNumber(pmt.amount), method: pmt.method },
    })
  }
  for (const q of quotations) {
    results.push({
      type: 'quotation',
      id: q.id,
      label: q.number,
      description: `${q.party.name} • ${q.status}`,
      href: `/?m=quotations&id=${q.id}`,
      meta: { date: q.date, total: toNumber(q.total) },
    })
  }
  for (const cn of creditNotes) {
    results.push({
      type: 'credit-note',
      id: cn.id,
      label: cn.number,
      description: `${cn.party.name}${cn.reason ? ` • ${cn.reason}` : ''}`,
      href: `/?m=credit-notes&id=${cn.id}`,
      meta: { date: cn.date, total: toNumber(cn.total) },
    })
  }

  return NextResponse.json({
    query: q,
    items: results.slice(0, limit),
    totalMatches: results.length,
  })
}
