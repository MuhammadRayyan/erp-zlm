// ============================================================
// ACTIVITY LOGGER — fire-and-forget logging for ActivityLog + AuditLog
// ============================================================
// All functions are non-blocking (the returned promise resolves after
// the write attempt, but callers should NOT await it in API hot paths —
// wrap in try/catch and discard errors so logging never breaks the main
// operation. See usage examples at the bottom of this file.
// ============================================================

import { db } from './db'

export type EntityType =
  | 'SALES_INVOICE'
  | 'PURCHASE_BILL'
  | 'PAYMENT'
  | 'JOURNAL_ENTRY'
  | 'PARTY'
  | 'ACCOUNT'
  | 'ITEM'
  | 'QUOTATION'
  | 'CREDIT_NOTE'
  | 'DELIVERY_NOTE'
  | 'BANK_ACCOUNT'
  | 'TAX_RATE'
  | 'CURRENCY'
  | 'TEMPLATE'
  | 'CUSTOM_FIELD'
  | 'BUSINESS'
  | 'USER'
  | 'TENANT'
  | 'LICENSE'
  | 'PLAN'

export type ActionType =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'POSTED'
  | 'VOIDED'
  | 'PAID'
  | 'EMAILED'
  | 'PRINTED'
  | 'COMMENTED'
  | 'VIEWED'
  | 'ARCHIVED'
  | 'RESTORED'

/**
 * Log a document-level activity event. Non-blocking — never throws.
 *
 * @param businessId current business id
 * @param userId     session.userId (must be a non-empty string — FK to User)
 * @param entityType e.g. SALES_INVOICE
 * @param entityId   the entity's id
 * @param action     e.g. CREATED, UPDATED, POSTED, VOIDED
 * @param message    human-readable message
 * @param metadata   optional JSON-serializable object (stored as JSON string)
 */
export async function logActivity(
  businessId: string,
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    if (!businessId || !userId || !entityId) return
    await db.activityLog.create({
      data: {
        businessId,
        userId,
        entityType,
        entityId,
        action,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })
  } catch (err) {
    // Never break the main operation. Log to stderr for debugging.
    console.error('[activity-logger] logActivity failed:', err)
  }
}

/**
 * Log a security/audit event. Non-blocking — never throws.
 *
 * @param businessId  current business id (use empty string for platform-level events)
 * @param tenantId    current tenant id (use empty string for platform-level events)
 * @param userId      session.userId or null for system events
 * @param action      e.g. LOGIN, CREATED, UPDATED, DELETED, POSTED, VOIDED
 * @param entityType  e.g. SALES_INVOICE, USER, TENANT
 * @param entityId    the entity's id
 * @param description optional human-readable description
 * @param changes     optional object describing before/after changes (JSON-stringified)
 * @param ipAddress   optional IP address from request headers
 */
export async function logAudit(
  businessId: string,
  tenantId: string,
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  description?: string,
  changes?: Record<string, { from: unknown; to: unknown }>,
  ipAddress?: string,
): Promise<void> {
  try {
    // businessId is a required FK to Business in the schema; skip if absent
    // (platform-level events without a business context are not logged here).
    if (!businessId || !tenantId || !entityId) return
    await db.auditLog.create({
      data: {
        businessId,
        tenantId,
        userId,
        action,
        entityType,
        entityId,
        description: description || null,
        changes: changes ? JSON.stringify(changes) : null,
        ipAddress: ipAddress || null,
      },
    })
  } catch (err) {
    // Never break the main operation. Log to stderr for debugging.
    console.error('[activity-logger] logAudit failed:', err)
  }
}

/**
 * Extract client IP address from a Next.js request, checking standard
 * forwarded-IP headers (works behind proxies/load balancers).
 */
export function getClientIp(req: Request): string | undefined {
  const headers = req.headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('cf-connecting-ip')?.trim() ||
    undefined
  )
}

/**
 * Log a full before/after change record to the AuditLog table.
 *
 * This is the canonical "audit trail" function for UPDATE and DELETE
 * operations. Callers MUST capture the pre-mutation record (the
 * Prisma `findUnique` result) BEFORE running the update or delete,
 * then pass it as `before`. After the operation, pass the post-
 * mutation record (or `null` for deletes) as `after`.
 *
 * The `before` and `after` objects are JSON-serialised and stored
 * in the AuditLog.changes column (a single JSON string) so the audit
 * UI can show a complete diff. Non-blocking — never throws.
 *
 * @param businessId  current business id
 * @param tenantId    current tenant id
 * @param userId      session.userId (null for system events)
 * @param entityType  e.g. SALES_INVOICE, PARTY, ACCOUNT, ITEM
 * @param entityId    the entity's id
 * @param action      typically 'UPDATED' or 'DELETED'
 * @param before      the pre-mutation record (object or null)
 * @param after       the post-mutation record (object or null for deletes)
 * @param req         optional NextRequest — used to extract client IP
 */
export async function logChange(
  businessId: string,
  tenantId: string,
  userId: string | null,
  entityType: string,
  entityId: string,
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  req?: Request,
): Promise<void> {
  try {
    if (!businessId || !tenantId || !entityId) return
    await db.auditLog.create({
      data: {
        businessId,
        tenantId,
        userId,
        action,
        entityType,
        entityId,
        description: `${entityType} ${action.toLowerCase()}`,
        changes: JSON.stringify({ before, after }),
        ipAddress: req ? getClientIp(req) ?? null : null,
      },
    })
  } catch (err) {
    console.error('[activity-logger] logChange failed:', err)
  }
}

// ============================================================
// USAGE EXAMPLES
// ============================================================
//
// import { logActivity, logAudit, getClientIp } from '@/lib/activity-logger'
//
// // After creating an invoice (fire-and-forget, do NOT await in hot path):
// void logActivity(businessId, user.id, 'SALES_INVOICE', invoice.id, 'CREATED',
//   `Invoice ${invoice.number} created`, { total: invoice.total })
//
// // Audit entry for the same operation:
// void logAudit(businessId, tenantId, user.id, 'CREATED', 'SALES_INVOICE',
//   invoice.id, `Invoice ${invoice.number} created`, undefined, getClientIp(req))
//
