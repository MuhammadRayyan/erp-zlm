import { NextRequest, NextResponse } from 'next/server'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Module activation: which sidebar modules are enabled for this business.
// Stored in AppSetting with key `module_activation_{businessId}`.
export interface ModuleActivation {
  dashboard: boolean
  accounts: boolean
  journal: boolean
  customers: boolean
  suppliers: boolean
  invoices: boolean
  bills: boolean
  payments: boolean
  quotations: boolean
  'credit-notes': boolean
  'delivery-notes': boolean
  items: boolean
  banking: boolean
  reports: boolean
  templates: boolean
  'custom-fields': boolean
  settings: boolean
  [key: string]: boolean
}

const NAMESPACE = 'module_activation'

const DEFAULTS: ModuleActivation = {
  dashboard: true,
  accounts: true,
  journal: true,
  customers: true,
  suppliers: true,
  invoices: true,
  bills: true,
  payments: true,
  quotations: true,
  'credit-notes': true,
  'delivery-notes': true,
  items: true,
  banking: true,
  reports: true,
  templates: true,
  'custom-fields': true,
  settings: true,
}

// GET /api/settings/modules
export async function GET() {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const stored = await getBusinessSetting<ModuleActivation>(businessId, NAMESPACE)
  return NextResponse.json({ ...DEFAULTS, ...stored })
}

// POST /api/settings/modules — update module activation
export async function POST(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const body = await req.json()
  const stored = (await getBusinessSetting<ModuleActivation>(businessId, NAMESPACE)) || {}
  const merged: ModuleActivation = { ...DEFAULTS, ...stored, ...body }
  await setBusinessSetting(businessId, NAMESPACE, merged)
  return NextResponse.json(merged)
}
