import { NextRequest, NextResponse } from 'next/server'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Accounting settings: decimal precision, VAT rounding mode, etc.
// Stored in AppSetting with key `accounting_settings_{businessId}`.
export interface AccountingSettings {
  precision?: number // decimal places for money (default 2)
  vatRoundingMode?: 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP'
  roundingAccountCode?: string
  negativeDisplay?: 'PARENTHESES' | 'MINUS'
  dateFormat?: string
  fiscalYearStart?: string // MM-DD
  defaultPaymentTerms?: number
  defaultCurrency?: string
  autoPostInvoices?: boolean
  autoPostBills?: boolean
  warnOnUnbalancedEntries?: boolean
}

const NAMESPACE = 'accounting_settings'

const DEFAULTS: AccountingSettings = {
  precision: 2,
  vatRoundingMode: 'HALF_UP',
  roundingAccountCode: '4900',
  negativeDisplay: 'MINUS',
  dateFormat: 'YYYY-MM-DD',
  fiscalYearStart: '01-01',
  defaultPaymentTerms: 30,
  defaultCurrency: 'AED',
  autoPostInvoices: false,
  autoPostBills: false,
  warnOnUnbalancedEntries: true,
}

// GET /api/settings/accounting
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
  const stored = await getBusinessSetting<AccountingSettings>(businessId, NAMESPACE)
  return NextResponse.json({ ...DEFAULTS, ...stored })
}

// POST /api/settings/accounting — update accounting settings
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
  const stored = (await getBusinessSetting<AccountingSettings>(businessId, NAMESPACE)) || {}
  const merged: AccountingSettings = { ...DEFAULTS, ...stored, ...body }
  await setBusinessSetting(businessId, NAMESPACE, merged)
  return NextResponse.json(merged)
}
