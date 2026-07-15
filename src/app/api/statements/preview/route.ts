import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { toNumber, money } from '@/lib/decimal'
import {
  computeOpeningBalance,
  collectTransactions,
  computeAging,
} from '../helpers'

// GET /api/statements/preview?partyId=xxx&startDate=xxx&endDate=xxx
// Returns an HTML rendering of the party statement suitable for printing/emailing.
export async function GET(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const partyId = searchParams.get('partyId')
  if (!partyId) return NextResponse.json({ error: 'partyId is required' }, { status: 400 })

  const party = await db.party.findFirst({ where: { id: partyId, businessId } })
  if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 })

  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const startDate = searchParams.get('startDate')
    ? new Date(searchParams.get('startDate')!)
    : new Date(new Date().getFullYear(), 0, 1)
  const endDate = searchParams.get('endDate')
    ? new Date(searchParams.get('endDate')!)
    : new Date()
  endDate.setHours(23, 59, 59, 999)

  const isCustomer = party.type === 'CUSTOMER' || party.type === 'BOTH'
  const isSupplier = party.type === 'SUPPLIER' || party.type === 'BOTH'

  const openingSigned = computeOpeningBalance(party.openingBalanceType, party.openingBalance)
  const priorTxs = await collectTransactions(businessId, partyId, isCustomer, isSupplier, undefined, startDate)
  const priorNet = priorTxs.reduce((s, t) => s.plus(money(t.debit).minus(money(t.credit))), money(0))
  const openingBalance = openingSigned.plus(priorNet)

  const rangeTxs = await collectTransactions(businessId, partyId, isCustomer, isSupplier, startDate, endDate)
  rangeTxs.sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    if (da !== db) return da - db
    return (a.sortKey || '').localeCompare(b.sortKey || '')
  })

  let running = openingBalance
  const rows = rangeTxs.map((t) => {
    running = running.plus(money(t.debit).minus(money(t.credit)))
    return {
      date: t.date,
      type: t.type,
      reference: t.reference,
      description: t.description,
      debit: toNumber(t.debit),
      credit: toNumber(t.credit),
      balance: toNumber(running),
    }
  })

  const totalDebit = toNumber(rows.reduce((s, r) => s.plus(money(r.debit)), money(0)))
  const totalCredit = toNumber(rows.reduce((s, r) => s.plus(money(r.credit)), money(0)))
  const closingBalance = toNumber(running)
  const aging = await computeAging(businessId, partyId, isCustomer, isSupplier, endDate)

  const currency = business.baseCurrency || 'AED'
  const fmt = (v: number | string) =>
    new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)) + ' ' + currency
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const partyTypeLabel = isCustomer && isSupplier ? 'Customer / Supplier' : isCustomer ? 'Customer' : 'Supplier'
  const statementTitle = isCustomer ? 'Customer Statement' : 'Supplier Statement'
  const balanceLabel = closingBalance >= 0
    ? (isCustomer ? 'Balance Due' : 'You Owe')
    : (isCustomer ? 'Credit Available' : 'Balance Due to You')

  const rowsHtml = rows.length === 0
    ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:#6b7280;">No transactions in this period</td></tr>`
    : rows.map((r) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${fmtDate(r.date)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;font-size:11px;text-transform:uppercase;">${r.type.replace(/_/g, ' ')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${r.reference}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.description)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${r.debit > 0 ? fmt(r.debit) : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${r.credit > 0 ? fmt(r.credit) : '—'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap;">${fmt(r.balance)}</td>
      </tr>
    `).join('')

  const agingRows = [
    { label: 'Current', value: aging.current },
    { label: '1-30 days', value: aging.days30 },
    { label: '31-60 days', value: aging.days60 },
    { label: '61-90 days', value: aging.days90 },
    { label: 'Over 90 days', value: aging.over90 },
  ]
  const agingHtml = aging.total > 0 ? `
    <div style="margin-top:24px;">
      <h3 style="margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Aging Summary</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr>
            <th style="padding:6px 8px;background:#f9fafb;text-align:left;border-bottom:2px solid #e5e7eb;">Bucket</th>
            <th style="padding:6px 8px;background:#f9fafb;text-align:right;border-bottom:2px solid #e5e7eb;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${agingRows.map((a) => `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${a.label}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(a.value)}</td>
            </tr>
          `).join('')}
          <tr style="font-weight:700;background:#f9fafb;">
            <td style="padding:6px 8px;">Total Outstanding</td>
            <td style="padding:6px 8px;text-align:right;">${fmt(aging.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  ` : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${statementTitle} — ${escapeHtml(party.name)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; font-size: 13px; padding: 32px; max-width: 900px; margin: 0 auto; }
  h1 { color: #16a34a; margin: 0 0 4px; font-size: 24px; }
  h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #16a34a; padding-bottom: 16px; margin-bottom: 24px; }
  .header .left { line-height: 1.5; }
  .header .right { text-align: right; line-height: 1.5; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 16px; padding: 12px 16px; background: #f9fafb; border-radius: 8px; }
  .meta div { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 8px; text-align: left; background: #f0fdf4; color: #166534; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #16a34a; }
  .right { text-align: right; }
  .totals { margin-left: auto; width: 320px; margin-top: 12px; }
  .totals td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  .grand-total { border-top: 2px solid #16a34a; padding-top: 8px; font-weight: bold; font-size: 15px; color: #16a34a; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">
      <h1>${escapeHtml(business.name)}</h1>
      ${business.legalName ? `<div>${escapeHtml(business.legalName)}</div>` : ''}
      ${business.addressLine1 ? `<div>${escapeHtml(business.addressLine1)}</div>` : ''}
      ${business.city ? `<div>${escapeHtml(business.city)}, ${escapeHtml(business.country)}</div>` : ''}
      ${business.trn ? `<div><strong>TRN:</strong> ${escapeHtml(business.trn)}</div>` : ''}
      ${business.email ? `<div>${escapeHtml(business.email)}</div>` : ''}
    </div>
    <div class="right">
      <h2>${statementTitle}</h2>
      <div><strong>Period:</strong> ${fmtDate(startDate)} – ${fmtDate(endDate)}</div>
      <div><strong>Issued:</strong> ${fmtDate(new Date())}</div>
    </div>
  </div>

  <div class="meta">
    <div>
      <strong>${partyTypeLabel}:</strong><br>
      ${escapeHtml(party.name)}<br>
      ${party.trn ? `TRN: ${escapeHtml(party.trn)}<br>` : ''}
      ${party.email ? `${escapeHtml(party.email)}<br>` : ''}
      ${party.phone ? `${escapeHtml(party.phone)}<br>` : ''}
    </div>
    <div class="right">
      <strong>Opening Balance</strong><br>
      <span style="font-size:18px;font-weight:600;">${fmt(toNumber(openingBalance))}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Reference</th>
        <th>Description</th>
        <th class="right">Debit</th>
        <th class="right">Credit</th>
        <th class="right">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background:#f9fafb;font-weight:600;">
        <td colspan="6" style="padding:6px 8px;">Opening Balance</td>
        <td class="right" style="padding:6px 8px;">${fmt(toNumber(openingBalance))}</td>
      </tr>
      ${rowsHtml}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Total Debits</td><td class="right">${fmt(totalDebit)}</td></tr>
    <tr><td>Total Credits</td><td class="right">${fmt(totalCredit)}</td></tr>
    <tr class="grand-total"><td>${balanceLabel}</td><td class="right">${fmt(Math.abs(closingBalance))}</td></tr>
  </table>

  ${agingHtml}

  <div class="footer">
    This statement was generated by AccountERP. Please contact us if you have any questions about this statement.
  </div>
</body>
</html>`

  // Return as HTML so the client can render in an iframe or open in a new tab for printing
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
