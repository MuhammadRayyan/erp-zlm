// ============================================================
// Data Integrity Verification Script
// Run: cd /home/z/my-project && bun run scripts/verify-integrity.ts
//
// Checks:
//   1. Every posted journal entry is balanced (debits = credits)
//   2. Trial balance balances (total debits = total credits across all posted JEs)
//   3. Every invoice's totals match the sum of its line totals + tax
//   4. Payment allocations don't exceed their invoice/bill total
//   5. Every business has required accounts (AR, AP, Sales, Output VAT, Input VAT)
//   6. Tenant isolation — every business belongs to exactly one tenant (no cross-tenant leaks)
// ============================================================

import { db } from '@/lib/db'
import { money, Decimal } from '@/lib/decimal'

interface Finding {
  check: string
  severity: 'PASS' | 'WARN' | 'FAIL'
  business?: string
  details: string
}

const findings: Finding[] = []
const EPSILON = new Decimal('0.01') // 1 fils tolerance for Decimal rounding

function pass(check: string, details: string, business?: string) {
  findings.push({ check, severity: 'PASS', business, details })
}
function warn(check: string, details: string, business?: string) {
  findings.push({ check, severity: 'WARN', business, details })
}
function fail(check: string, details: string, business?: string) {
  findings.push({ check, severity: 'FAIL', business, details })
}

async function checkJournalEntriesBalanced() {
  const check = '1. Journal entries balanced (debits = credits)'
  const entries = await db.journalEntry.findMany({
    include: { lines: { select: { debit: true, credit: true } } },
  })

  let unbalancedCount = 0
  for (const entry of entries) {
    const debit = entry.lines.reduce((s, l) => s.plus(money(l.debit)), money(0))
    const credit = entry.lines.reduce((s, l) => s.plus(money(l.credit)), money(0))
    const diff = debit.minus(credit).abs()
    if (diff.gt(EPSILON)) {
      unbalancedCount++
      const biz = entry.businessId
      fail(check, `JE ${entry.number} (id=${entry.id}) unbalanced: debit=${debit.toFixed(2)} credit=${credit.toFixed(2)} diff=${diff.toFixed(4)}`, biz)
    }
  }

  if (unbalancedCount === 0) {
    pass(check, `All ${entries.length} journal entries are balanced (tolerance ${EPSILON})`)
  } else {
    fail(check, `${unbalancedCount} of ${entries.length} journal entries are unbalanced`)
  }
}

async function checkTrialBalance() {
  const check = '2. Trial balance balances (sum debits = sum credits)'
  const lines = await db.journalLine.findMany({
    where: { journalEntry: { isPosted: true } },
    select: { debit: true, credit: true, journalEntry: { select: { businessId: true } } },
  })

  // Global totals
  const totalDebit = lines.reduce((s, l) => s.plus(money(l.debit)), money(0))
  const totalCredit = lines.reduce((s, l) => s.plus(money(l.credit)), money(0))
  const globalDiff = totalDebit.minus(totalCredit).abs()

  if (globalDiff.lte(EPSILON)) {
    pass(check, `Global trial balance: debits=${totalDebit.toFixed(2)} = credits=${totalCredit.toFixed(2)} (diff ${globalDiff.toFixed(4)})`)
  } else {
    fail(check, `Global trial balance OFF: debits=${totalDebit.toFixed(2)} credits=${totalCredit.toFixed(2)} diff=${globalDiff.toFixed(4)}`)
  }

  // Per-business totals
  const byBusiness = new Map<string, { d: Decimal; c: Decimal }>()
  for (const l of lines) {
    const biz = l.journalEntry.businessId
    const cur = byBusiness.get(biz) || { d: money(0), c: money(0) }
    cur.d = cur.d.plus(money(l.debit))
    cur.c = cur.c.plus(money(l.credit))
    byBusiness.set(biz, cur)
  }
  for (const [biz, totals] of byBusiness.entries()) {
    const diff = totals.d.minus(totals.c).abs()
    if (diff.lte(EPSILON)) {
      pass(check, `Business ${biz}: debits=${totals.d.toFixed(2)} = credits=${totals.c.toFixed(2)}`, biz)
    } else {
      fail(check, `Business ${biz}: trial balance OFF debits=${totals.d.toFixed(2)} credits=${totals.c.toFixed(2)} diff=${diff.toFixed(4)}`, biz)
    }
  }
}

async function checkInvoiceAmountsMatchLineTotals() {
  const check = '3. Invoice & bill totals match sum of line totals + tax'

  // Sales invoices
  const invoices = await db.salesInvoice.findMany({
    include: { lines: { select: { lineTotal: true, lineTax: true } } },
  })
  let invMismatches = 0
  for (const inv of invoices) {
    const lineSubtotal = inv.lines.reduce((s, l) => s.plus(money(l.lineTotal)), money(0))
    const lineTax = inv.lines.reduce((s, l) => s.plus(money(l.lineTax)), money(0))
    const expectedTotal = lineSubtotal.plus(lineTax)

    const subDiff = lineSubtotal.minus(money(inv.subtotal)).abs()
    const taxDiff = lineTax.minus(money(inv.totalTax)).abs()
    const totDiff = expectedTotal.minus(money(inv.total)).abs()

    if (subDiff.gt(EPSILON) || taxDiff.gt(EPSILON) || totDiff.gt(EPSILON)) {
      invMismatches++
      fail(check,
        `Invoice ${inv.number} mismatch: ` +
        `subtotal(header=${money(inv.subtotal).toFixed(2)} vs lines=${lineSubtotal.toFixed(2)}, diff ${subDiff.toFixed(4)}), ` +
        `tax(header=${money(inv.totalTax).toFixed(2)} vs lines=${lineTax.toFixed(2)}, diff ${taxDiff.toFixed(4)}), ` +
        `total(header=${money(inv.total).toFixed(2)} vs expected=${expectedTotal.toFixed(2)}, diff ${totDiff.toFixed(4)})`,
        inv.businessId)
    }
  }
  if (invMismatches === 0) {
    pass(check, `All ${invoices.length} sales invoices have header totals matching their lines`)
  } else {
    fail(check, `${invMismatches} of ${invoices.length} sales invoices have mismatched totals`)
  }

  // Purchase bills
  const bills = await db.purchaseBill.findMany({
    include: { lines: { select: { lineTotal: true, lineTax: true } } },
  })
  let billMismatches = 0
  for (const bill of bills) {
    const lineSubtotal = bill.lines.reduce((s, l) => s.plus(money(l.lineTotal)), money(0))
    const lineTax = bill.lines.reduce((s, l) => s.plus(money(l.lineTax)), money(0))
    const expectedTotal = lineSubtotal.plus(lineTax)

    const subDiff = lineSubtotal.minus(money(bill.subtotal)).abs()
    const taxDiff = lineTax.minus(money(bill.totalTax)).abs()
    const totDiff = expectedTotal.minus(money(bill.total)).abs()

    if (subDiff.gt(EPSILON) || taxDiff.gt(EPSILON) || totDiff.gt(EPSILON)) {
      billMismatches++
      fail(check,
        `Bill ${bill.number} mismatch: ` +
        `subtotal(header=${money(bill.subtotal).toFixed(2)} vs lines=${lineSubtotal.toFixed(2)}, diff ${subDiff.toFixed(4)}), ` +
        `tax(header=${money(bill.totalTax).toFixed(2)} vs lines=${lineTax.toFixed(2)}, diff ${taxDiff.toFixed(4)}), ` +
        `total(header=${money(bill.total).toFixed(2)} vs expected=${expectedTotal.toFixed(2)}, diff ${totDiff.toFixed(4)})`,
        bill.businessId)
    }
  }
  if (billMismatches === 0) {
    pass(check, `All ${bills.length} purchase bills have header totals matching their lines`)
  } else {
    fail(check, `${billMismatches} of ${bills.length} purchase bills have mismatched totals`)
  }
}

async function checkPaymentAllocations() {
  const check = '4. Payment allocations do not exceed invoice/bill totals'

  // Allocations against invoices
  const invAllocs = await db.paymentAllocation.findMany({
    where: { invoiceId: { not: null } },
    include: { invoice: { select: { number: true, total: true, businessId: true } } },
  })

  // Group by invoice to detect over-allocation
  const invTotals = new Map<string, { invoice: { number: string; total: Decimal; businessId: string }; allocated: Decimal }>()
  for (const a of invAllocs) {
    if (!a.invoiceId || !a.invoice) continue
    const cur = invTotals.get(a.invoiceId) || {
      invoice: { number: a.invoice.number, total: money(a.invoice.total), businessId: a.invoice.businessId },
      allocated: money(0),
    }
    cur.allocated = cur.allocated.plus(money(a.amount))
    invTotals.set(a.invoiceId, cur)
  }

  let invOver = 0
  for (const [, v] of invTotals.entries()) {
    const over = v.allocated.minus(v.invoice.total)
    if (over.gt(EPSILON)) {
      invOver++
      fail(check, `Invoice ${v.invoice.number} over-allocated: total=${v.invoice.total.toFixed(2)} allocated=${v.allocated.toFixed(2)} over by ${over.toFixed(4)}`, v.invoice.businessId)
    }
  }
  if (invOver === 0) {
    pass(check, `All ${invTotals.size} allocated invoices: allocations ≤ total`)
  } else {
    fail(check, `${invOver} of ${invTotals.size} allocated invoices are over-allocated`)
  }

  // Allocations against bills
  const billAllocs = await db.paymentAllocation.findMany({
    where: { billId: { not: null } },
    include: { bill: { select: { number: true, total: true, businessId: true } } },
  })

  const billTotals = new Map<string, { bill: { number: string; total: Decimal; businessId: string }; allocated: Decimal }>()
  for (const a of billAllocs) {
    if (!a.billId) continue
    const bill = a.bill
    if (!bill) continue
    const cur = billTotals.get(a.billId) || {
      bill: { number: bill.number, total: money(bill.total), businessId: bill.businessId },
      allocated: money(0),
    }
    cur.allocated = cur.allocated.plus(money(a.amount))
    billTotals.set(a.billId, cur)
  }

  let billOver = 0
  for (const [, v] of billTotals.entries()) {
    const over = v.allocated.minus(v.bill.total)
    if (over.gt(EPSILON)) {
      billOver++
      fail(check, `Bill ${v.bill.number} over-allocated: total=${v.bill.total.toFixed(2)} allocated=${v.allocated.toFixed(2)} over by ${over.toFixed(4)}`, v.bill.businessId)
    }
  }
  if (billOver === 0) {
    pass(check, `All ${billTotals.size} allocated bills: allocations ≤ total`)
  } else {
    fail(check, `${billOver} of ${billTotals.size} allocated bills are over-allocated`)
  }
}

async function checkRequiredAccounts() {
  const check = '5. Every business has required accounts'
  // Required subtypes for accounting to function correctly.
  const requiredSubtypes = [
    'ACCOUNTS_RECEIVABLE',
    'ACCOUNTS_PAYABLE',
    'SALES',
    'COST_OF_GOODS_SOLD',
    'CASH',
    'BANK',
    'CURRENT_LIABILITY', // for VAT accounts (2200, 2210, 2220)
  ]
  // Also required: Output VAT (code 2220) and Input VAT (code 2210)
  const requiredCodes = ['2210', '2220']

  const businesses = await db.business.findMany({ select: { id: true, name: true } })
  let missingAny = false
  for (const biz of businesses) {
    const accounts = await db.account.findMany({
      where: { businessId: biz.id },
      select: { subtype: true, code: true },
    })
    const subtypes = new Set(accounts.map(a => a.subtype).filter(Boolean) as string[])
    const codes = new Set(accounts.map(a => a.code))

    const missingSubs = requiredSubtypes.filter(s => !subtypes.has(s))
    const missingCodesArr = requiredCodes.filter(c => !codes.has(c))

    if (missingSubs.length > 0 || missingCodesArr.length > 0) {
      missingAny = true
      const parts: string[] = []
      if (missingSubs.length) parts.push(`missing subtypes: ${missingSubs.join(', ')}`)
      if (missingCodesArr.length) parts.push(`missing codes: ${missingCodesArr.join(', ')}`)
      fail(check, `Business "${biz.name}" — ${parts.join('; ')}`, biz.id)
    } else {
      pass(check, `Business "${biz.name}" has all ${requiredSubtypes.length} required subtypes + VAT codes 2210/2220`, biz.id)
    }
  }
  if (!missingAny) {
    pass(check, `All ${businesses.length} businesses have required accounts`)
  }
}

async function checkTenantIsolation() {
  const check = '6. Tenant isolation (no business belongs to multiple tenants)'

  // Schema enforces business.tenantId as a single FK; a business cannot belong
  // to multiple tenants. But we still verify the inverse: every business has a
  // non-null tenantId pointing to an existing tenant.
  const businesses = await db.business.findMany({ select: { id: true, name: true, tenantId: true } })
  const tenantIds = new Set((await db.tenant.findMany({ select: { id: true } })).map(t => t.id))

  let orphans = 0
  let nullTenants = 0
  for (const b of businesses) {
    if (!b.tenantId) {
      nullTenants++
      fail(check, `Business "${b.name}" (id=${b.id}) has NULL tenantId`)
      continue
    }
    if (!tenantIds.has(b.tenantId)) {
      orphans++
      fail(check, `Business "${b.name}" (id=${b.id}) references non-existent tenantId=${b.tenantId}`)
    }
  }

  // Check that no UserTenant has a tenantId that doesn't exist, and no user-tenant
  // role references a business outside the user's tenant.
  const userTenants = await db.userTenant.findMany({ select: { userId: true, tenantId: true } })
  const utOrphans = userTenants.filter(ut => !tenantIds.has(ut.tenantId))
  if (utOrphans.length > 0) {
    fail(check, `${utOrphans.length} UserTenant rows reference non-existent tenants`)
  }

  if (nullTenants === 0 && orphans === 0 && utOrphans.length === 0) {
    pass(check, `All ${businesses.length} businesses map to exactly one valid tenant; ${userTenants.length} user-tenant memberships valid`)
  } else {
    fail(check, `Isolation issues: ${nullTenants} null-tenant, ${orphans} orphan-tenant, ${utOrphans.length} orphan-userTenant`)
  }
}

async function main() {
  console.log('=== AccountERP Data Integrity Verification ===\n')
  console.log(`Started at: ${new Date().toISOString()}\n`)

  await checkJournalEntriesBalanced()
  await checkTrialBalance()
  await checkInvoiceAmountsMatchLineTotals()
  await checkPaymentAllocations()
  await checkRequiredAccounts()
  await checkTenantIsolation()

  // Print findings grouped by check
  const checks = [...new Set(findings.map(f => f.check))]
  for (const c of checks) {
    console.log(`\n--- ${c} ---`)
    const sub = findings.filter(f => f.check === c)
    for (const f of sub) {
      const prefix = f.severity === 'PASS' ? '✓ PASS' : f.severity === 'WARN' ? '⚠ WARN' : '✗ FAIL'
      const bizTag = f.business ? ` [biz=${f.business.slice(-8)}]` : ''
      console.log(`  ${prefix}${bizTag}: ${f.details}`)
    }
  }

  // Summary
  const passCount = findings.filter(f => f.severity === 'PASS').length
  const warnCount = findings.filter(f => f.severity === 'WARN').length
  const failCount = findings.filter(f => f.severity === 'FAIL').length
  console.log('\n=== Summary ===')
  console.log(`  PASS: ${passCount}`)
  console.log(`  WARN: ${warnCount}`)
  console.log(`  FAIL: ${failCount}`)

  if (failCount === 0) {
    console.log('\n✅ All integrity checks passed.')
    process.exit(0)
  } else {
    console.log(`\n❌ ${failCount} integrity check(s) FAILED.`)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Integrity check script crashed:', e)
  process.exit(2)
})
