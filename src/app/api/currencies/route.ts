import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureDefaultBusiness } from '@/lib/business-context'
import { toNumber } from '@/lib/decimal'

// GET /api/currencies
export async function GET() {
  const businessId = await ensureDefaultBusiness()
  

  const currencies = await db.currency.findMany({
    where: { businessId },
    orderBy: { isBase: 'desc' },
  })

  return NextResponse.json(currencies.map(c => ({
    id: c.id, code: c.code, name: c.name, symbol: c.symbol,
    isBase: c.isBase, exchangeRate: toNumber(c.exchangeRate),
  })))
}
