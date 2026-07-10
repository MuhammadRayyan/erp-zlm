import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId } from '@/lib/auth'
import { toNumber } from '@/lib/decimal'

// GET /api/currencies
export async function GET() {
  const businessId = await ensureBusinessId()
  

  const currencies = await db.currency.findMany({
    where: { businessId },
    orderBy: { isBase: 'desc' },
  })

  return NextResponse.json(currencies.map(c => ({
    id: c.id, code: c.code, name: c.name, symbol: c.symbol,
    isBase: c.isBase, exchangeRate: toNumber(c.exchangeRate),
  })))
}
