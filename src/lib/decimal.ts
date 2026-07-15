// ============================================================
// DECIMAL MATH — Financial calculation utilities
// ============================================================
// ALL monetary calculations MUST use these functions, never native
// JavaScript numbers (floating point causes rounding errors).
//
// Uses decimal.js with precision=30, ROUND_HALF_UP.
//
// Key functions:
// - money(v): Convert to Decimal
// - add/sub/mul/div: Arithmetic
// - lineTotal(qty, price, discount): Calculate line net amount
// - calcVAT(amount, rate): Calculate VAT on an amount
// - formatMoney(v, currency): Display formatting
// - toNumber(v): Convert to JS number for JSON responses
// ============================================================

import Decimal from 'decimal.js'

// Configure decimal.js for financial precision
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP })

export { Decimal }

// Money helpers — always use these, never native floats
export const money = (v: Decimal | string | number): Decimal => new Decimal(v || 0)

export const add = (...vals: (Decimal | string | number | null | undefined)[]): Decimal =>
  vals.reduce<Decimal>((sum, v) => sum.plus(money(v || 0)), money(0))

export const sub = (a: Decimal | string | number, b: Decimal | string | number): Decimal =>
  money(a).minus(money(b))

export const mul = (a: Decimal | string | number, b: Decimal | string | number): Decimal =>
  money(a).times(money(b))

export const div = (a: Decimal | string | number, b: Decimal | string | number): Decimal => {
  const divisor = money(b)
  if (divisor.isZero()) return money(0)
  return money(a).div(divisor)
}

// Calculate line total: qty * price * (1 - discountPct/100)
export const lineTotal = (
  quantity: Decimal | string | number,
  unitPrice: Decimal | string | number,
  discountPct: Decimal | string | number = 0
): Decimal => {
  const gross = mul(quantity, unitPrice)
  const discount = mul(gross, div(discountPct, 100))
  return gross.minus(discount)
}

// Calculate VAT on an amount at a given rate
export const calcVAT = (
  amount: Decimal | string | number,
  rate: Decimal | string | number
): Decimal => mul(amount, div(rate, 100))

// Format money for display: 1,234.56
export const formatMoney = (v: Decimal | string | number, currency = 'AED', decimals = 2): string => {
  const d = money(v)
  const formatted = d.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const symbols: Record<string, string> = {
    AED: 'د.إ', USD: '$', EUR: '€', GBP: '£', SAR: '﷼', INR: '₹', PKR: '₨',
  }
  const sym = symbols[currency] || currency
  return `${sym} ${formatted}`
}

// Format number without currency symbol
export const formatNumber = (v: Decimal | string | number, decimals = 2): string => {
  const d = money(v)
  return d.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Parse a user-entered money string to Decimal
export const parseMoney = (s: string): Decimal => {
  if (!s) return money(0)
  const cleaned = s.replace(/[^0-9.\-]/g, '')
  try {
    return money(cleaned)
  } catch {
    return money(0)
  }
}

// Check if debits == credits in a set of journal lines
export const isBalanced = (
  lines: { debit: Decimal | string | number; credit: Decimal | string | number }[]
): boolean => {
  const totalDebit = lines.reduce((s, l) => s.plus(money(l.debit)), money(0))
  const totalCredit = lines.reduce((s, l) => s.plus(money(l.credit)), money(0))
  return totalDebit.eq(totalCredit)
}

// Convert Prisma Decimal/string to number for JSON responses (with 4 decimal precision)
export const toNumber = (v: Decimal | string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0
  return parseFloat(money(v).toFixed(4))
}
