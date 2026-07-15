import { db } from './db'
import { money } from './decimal'

// ============================================================
// APPROVAL WORKFLOW SERVICE
// ============================================================
//
// When the approval workflow is enabled for a business (stored in
// AppSetting under key `approval_settings_{businessId}`), documents
// (invoices, bills, payments) above the configured threshold must be
// approved before posting. While pending, they sit with
// approvalStatus='PENDING' and no journal entry is created.
// ============================================================

export interface ApprovalSettings {
  requireApproval: boolean
  invoiceThreshold: number
  billThreshold: number
  paymentThreshold: number
}

export const DEFAULT_APPROVAL_SETTINGS: ApprovalSettings = {
  requireApproval: false,
  invoiceThreshold: 10000,
  billThreshold: 10000,
  paymentThreshold: 10000,
}

const SETTING_KEY = (businessId: string) => `approval_settings_${businessId}`

function normalize(input: Partial<ApprovalSettings> | null | undefined): ApprovalSettings {
  const s = { ...DEFAULT_APPROVAL_SETTINGS, ...(input || {}) }
  s.requireApproval = !!s.requireApproval
  s.invoiceThreshold = Math.max(0, Number(s.invoiceThreshold) || 0)
  s.billThreshold = Math.max(0, Number(s.billThreshold) || 0)
  s.paymentThreshold = Math.max(0, Number(s.paymentThreshold) || 0)
  return s
}

export async function getApprovalSettings(businessId: string): Promise<ApprovalSettings> {
  if (!businessId) return DEFAULT_APPROVAL_SETTINGS
  const row = await db.appSetting.findUnique({ where: { key: SETTING_KEY(businessId) } })
  if (!row?.value) return DEFAULT_APPROVAL_SETTINGS
  try {
    const parsed = JSON.parse(row.value) as Partial<ApprovalSettings>
    return normalize(parsed)
  } catch {
    return DEFAULT_APPROVAL_SETTINGS
  }
}

export async function saveApprovalSettings(
  businessId: string,
  input: Partial<ApprovalSettings>,
): Promise<ApprovalSettings> {
  const normalized = normalize(input)
  await db.appSetting.upsert({
    where: { key: SETTING_KEY(businessId) },
    create: { key: SETTING_KEY(businessId), value: JSON.stringify(normalized) },
    update: { value: JSON.stringify(normalized) },
  })
  return normalized
}

/**
 * Returns true if a sales invoice with the given total requires approval
 * before posting under the current business approval settings.
 */
export async function invoiceRequiresApproval(
  businessId: string,
  totalAmount: number | string,
): Promise<boolean> {
  const s = await getApprovalSettings(businessId)
  if (!s.requireApproval) return false
  return money(totalAmount).gt(money(s.invoiceThreshold))
}

/**
 * Returns true if a purchase bill with the given total requires approval.
 */
export async function billRequiresApproval(
  businessId: string,
  totalAmount: number | string,
): Promise<boolean> {
  const s = await getApprovalSettings(businessId)
  if (!s.requireApproval) return false
  return money(totalAmount).gt(money(s.billThreshold))
}

/**
 * Returns true if a payment with the given amount requires approval.
 */
export async function paymentRequiresApproval(
  businessId: string,
  amount: number | string,
): Promise<boolean> {
  const s = await getApprovalSettings(businessId)
  if (!s.requireApproval) return false
  return money(amount).gt(money(s.paymentThreshold))
}
