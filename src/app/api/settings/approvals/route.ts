import { NextRequest, NextResponse } from 'next/server'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Approval workflow settings: which document types require approval,
// who must approve, and how many approvals are required.
// Stored in AppSetting with key `approval_settings_{businessId}`.
export interface ApprovalSettings {
  requireInvoiceApproval: boolean
  requireBillApproval: boolean
  requirePaymentApproval: boolean
  requireJournalApproval: boolean
  requireCreditNoteApproval: boolean
  minAmountForApproval: number // documents below this amount bypass approval
  approverRole: 'TENANT_ADMIN' | 'ACCOUNTANT' | 'TENANT_ADMIN_OR_ACCOUNTANT'
  multiLevelApproval: boolean
  notifyOnApprovalRequest: boolean
  autoApproveBelow: number
}

const NAMESPACE = 'approval_settings'

const DEFAULTS: ApprovalSettings = {
  requireInvoiceApproval: false,
  requireBillApproval: false,
  requirePaymentApproval: false,
  requireJournalApproval: false,
  requireCreditNoteApproval: true,
  minAmountForApproval: 0,
  approverRole: 'TENANT_ADMIN',
  multiLevelApproval: false,
  notifyOnApprovalRequest: true,
  autoApproveBelow: 0,
}

// GET /api/settings/approvals
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
  const stored = await getBusinessSetting<ApprovalSettings>(businessId, NAMESPACE)
  return NextResponse.json({ ...DEFAULTS, ...stored })
}

// POST /api/settings/approvals — update approval workflow settings
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
  const stored = (await getBusinessSetting<ApprovalSettings>(businessId, NAMESPACE)) || {}
  const merged: ApprovalSettings = { ...DEFAULTS, ...stored, ...body }
  await setBusinessSetting(businessId, NAMESPACE, merged)
  return NextResponse.json(merged)
}
