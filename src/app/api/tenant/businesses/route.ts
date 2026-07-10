import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentTenantId, hasPermission, getCurrentBusinessId } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET /api/tenant/businesses — list businesses in current tenant
export async function GET() {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const currentBusinessId = await getCurrentBusinessId()

  const businesses = await db.business.findMany({
    where: { tenantId },
    include: { _count: { select: { salesInvoices: true, parties: true, items: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(businesses.map(b => ({
    id: b.id,
    name: b.name,
    legalName: b.legalName,
    trn: b.trn,
    email: b.email,
    city: b.city,
    state: b.state,
    baseCurrency: b.baseCurrency,
    vatRegistered: b.vatRegistered,
    vatRate: Number(b.vatRate),
    isActive: true,
    invoiceCount: b._count.salesInvoices,
    customerCount: b._count.parties,
    itemCount: b._count.items,
    isCurrent: b.id === currentBusinessId,
  })))
}

// POST — create business
export async function POST(req: NextRequest) {
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json({ error: 'Tenant admin access required' }, { status: 403 })
  }

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  // Check plan limits
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: { include: { plan: true } } },
  })
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  const maxBusinesses = tenant.subscription?.plan?.maxBusinesses || 1
  const currentBusinesses = await db.business.count({ where: { tenantId } })
  if (currentBusinesses >= maxBusinesses) {
    return NextResponse.json({ error: `Business limit reached (${maxBusinesses}). Upgrade your plan to add more businesses.` }, { status: 400 })
  }

  const body = await req.json()
  const business = await db.business.create({
    data: {
      tenantId,
      name: body.name,
      legalName: body.legalName || null,
      trn: body.trn || null,
      email: body.email || null,
      phone: body.phone || null,
      addressLine1: body.addressLine1 || null,
      city: body.city || null,
      state: body.state || null,
      country: body.country || 'AE',
      baseCurrency: body.baseCurrency || 'AED',
      vatRegistered: body.vatRegistered !== false,
      vatRate: body.vatRate || 5.0,
    },
  })

  // Seed chart of accounts, tax rates, currencies, templates
  const { seedChartOfAccounts, seedTaxRates, seedCurrencies, seedDefaultTemplates } = await import('@/lib/seed')
  await seedChartOfAccounts(business.id)
  await seedTaxRates(business.id)
  await seedCurrencies(business.id)
  await seedDefaultTemplates(business.id)

  // Set as current business
  const cookieStore = await cookies()
  cookieStore.set('accounterp_business', business.id, { path: '/', maxAge: 60 * 60 * 24 * 365 })

  return NextResponse.json(business)
}

// PUT — update business
export async function PUT(req: NextRequest) {
  if (!(await hasPermission('tenant.settings'))) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  // Verify business belongs to tenant
  const business = await db.business.findFirst({ where: { id, tenantId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const body = await req.json()
  const allowed = [
    'name', 'legalName', 'trn', 'email', 'phone', 'website',
    'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country',
    'baseCurrency', 'vatRegistered', 'vatRate',
    'invoicePrefix', 'billPrefix', 'quotationPrefix', 'creditNotePrefix',
    'receiptPrefix', 'paymentPrefix', 'deliveryNotePrefix', 'logoUrl',
  ]

  const data: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) data[k] = body[k]
  }

  const updated = await db.business.update({ where: { id }, data })
  return NextResponse.json(updated)
}

// DELETE — delete business (only if no transactions)
export async function DELETE(req: NextRequest) {
  if (!(await hasPermission('tenant.admin'))) {
    return NextResponse.json({ error: 'Tenant admin access required' }, { status: 403 })
  }

  const tenantId = await getCurrentTenantId()
  if (!tenantId) return NextResponse.json({ error: 'No tenant context' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const business = await db.business.findFirst({ where: { id, tenantId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const invoiceCount = await db.salesInvoice.count({ where: { businessId: id } })
  if (invoiceCount > 0) {
    return NextResponse.json({ error: 'Cannot delete business with transactions. Consider archiving instead.' }, { status: 400 })
  }

  await db.business.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
