import { Decimal, money, mul, div, calcVAT, lineTotal, toNumber } from './decimal'

export interface LineItemInput {
  quantity: number | string
  unitPrice: number | string
  discount: number | string // percentage
  taxRate: number | string // percentage (0, 5, etc.)
  taxCategory?: string // STANDARD_RATED, ZERO_RATED, EXEMPT, OUT_OF_SCOPE
}

export interface LineItemCalc extends LineItemInput {
  grossAmount: number
  discountAmount: number
  netAmount: number
  taxAmount: number
  total: number
}

// Calculate a single line item with VAT
export function calculateLine(item: LineItemInput): LineItemCalc {
  const qty = money(item.quantity)
  const price = money(item.unitPrice)
  const discountPct = money(item.discount)
  const rate = money(item.taxRate)

  const grossAmount = mul(qty, price)
  const discountAmount = mul(grossAmount, div(discountPct, 100))
  const netAmount = grossAmount.minus(discountAmount)
  const taxAmount = calcVAT(netAmount, rate)
  const total = netAmount.plus(taxAmount)

  return {
    ...item,
    grossAmount: toNumber(grossAmount),
    discountAmount: toNumber(discountAmount),
    netAmount: toNumber(netAmount),
    taxAmount: toNumber(taxAmount),
    total: toNumber(total),
  }
}

export interface DocumentTotals {
  subtotal: number
  totalDiscount: number
  totalTax: number
  total: number
  taxBreakdown: { rate: number; category: string; netAmount: number; taxAmount: number; grossAmount: number }[]
}

// Calculate document totals from line items
export function calculateDocumentTotals(lines: LineItemInput[]): DocumentTotals {
  const calculated = lines.map(calculateLine)

  const subtotal = calculated.reduce((s, l) => s + l.grossAmount, 0)
  const totalDiscount = calculated.reduce((s, l) => s + l.discountAmount, 0)
  const totalTax = calculated.reduce((s, l) => s + l.taxAmount, 0)
  const total = calculated.reduce((s, l) => s + l.total, 0)

  // Group by tax rate for VAT breakdown
  const breakdownMap = new Map<string, { rate: number; category: string; netAmount: number; taxAmount: number; grossAmount: number }>()
  for (const l of calculated) {
    const key = `${l.taxRate}-${l.taxCategory || 'STANDARD_RATED'}`
    const existing = breakdownMap.get(key) || { rate: Number(l.taxRate), category: l.taxCategory || 'STANDARD_RATED', netAmount: 0, taxAmount: 0, grossAmount: 0 }
    existing.netAmount += l.netAmount
    existing.taxAmount += l.taxAmount
    existing.grossAmount += l.total
    breakdownMap.set(key, existing)
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    total: Math.round(total * 100) / 100,
    taxBreakdown: Array.from(breakdownMap.values()),
  }
}

// Validate a UAE TRN (15 digits)
export function validateTRN(trn: string): boolean {
  if (!trn) return false
  const cleaned = trn.replace(/[^0-9]/g, '')
  return cleaned.length === 15
}

// Generate a PINT AE-compatible UUID for e-invoicing
export function generateEInvoiceUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
