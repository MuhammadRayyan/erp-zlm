import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusiness, getCurrentTenantId, ensureBusinessId, hasPermission } from '@/lib/auth'

// GET /api/business — current business (auto-creates if none)
export async function GET() {
  let business = await getCurrentBusiness()
  if (!business) {
    const id = await ensureBusinessId()
    business = await db.business.findUnique({ where: { id } })
  }
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

  return NextResponse.json({
    id: business.id,
    name: business.name,
    legalName: business.legalName,
    trn: business.trn,
    email: business.email,
    phone: business.phone,
    website: business.website,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2,
    city: business.city,
    state: business.state,
    postalCode: business.postalCode,
    country: business.country,
    baseCurrency: business.baseCurrency,
    vatRegistered: business.vatRegistered,
    vatRate: Number(business.vatRate),
    invoicePrefix: business.invoicePrefix,
    billPrefix: business.billPrefix,
    quotationPrefix: business.quotationPrefix,
    creditNotePrefix: business.creditNotePrefix,
    receiptPrefix: business.receiptPrefix,
    paymentPrefix: business.paymentPrefix,
    deliveryNotePrefix: business.deliveryNotePrefix,
    logoUrl: business.logoUrl,
    tenantId: business.tenantId,
  })
}

// PUT /api/business — update business settings
export async function PUT(req: NextRequest) {
  if (!(await hasPermission('tenant.settings'))) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const business = await getCurrentBusiness()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 400 })

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

  const updated = await db.business.update({ where: { id: business.id }, data })
  return NextResponse.json(updated)
}
