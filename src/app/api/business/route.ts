import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusiness, getCurrentBusinessId } from '@/lib/business-context'
import { cookies } from 'next/headers'

// GET /api/business — current business (auto-creates if none)
export async function GET() {
  let business = await getCurrentBusiness()
  if (!business) {
    const { seedDefaultData } = await import('@/lib/seed')
    business = await seedDefaultData()
    const cookieStore = await cookies()
    cookieStore.set('businessId', business.id, { path: '/', maxAge: 60 * 60 * 24 * 365 })
  } else {
    const cookieStore = await cookies()
    if (!cookieStore.get('businessId')?.value) {
      cookieStore.set('businessId', business.id, { path: '/', maxAge: 60 * 60 * 24 * 365 })
    }
  }
  return NextResponse.json(business)
}

// PUT /api/business — update business settings
export async function PUT(req: NextRequest) {
  const businessId = await ensureDefaultBusiness()
  

  const body = await req.json()
  const allowed = [
    'name', 'legalName', 'trn', 'email', 'phone', 'website',
    'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country',
    'baseCurrency', 'vatRegistered', 'vatRate',
    'invoicePrefix', 'billPrefix', 'quotationPrefix', 'creditNotePrefix',
    'receiptPrefix', 'paymentPrefix', 'deliveryNotePrefix',
    'logoUrl',
  ]

  const data: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) data[k] = body[k]
  }

  const updated = await db.business.update({ where: { id: businessId }, data })
  return NextResponse.json(updated)
}
