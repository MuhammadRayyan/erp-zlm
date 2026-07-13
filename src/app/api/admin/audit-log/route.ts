import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, getCurrentTenantId } from '@/lib/auth'

// GET /api/admin/audit-log — platform-wide audit log (platform admin only)
//
// Query params:
//   tenantId   — filter by tenant
//   businessId — filter by business
//   userId     — filter by user
//   action     — filter by action (e.g. LOGIN, BACKUP_EXPORT)
//   entityType — filter by entity type
//   entityId   — filter by entity id
//   from       — ISO date string (inclusive)
//   to         — ISO date string (inclusive)
//   limit      — page size (default 100, max 500)
//   cursor     — id for pagination
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!(await hasPermission('platform.admin'))) {
    return NextResponse.json(
      { error: 'Platform admin access required' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenantId')
  const businessId = searchParams.get('businessId')
  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 500)

  const where: {
    tenantId?: string
    businessId?: string
    userId?: string
    action?: string
    entityType?: string
    entityId?: string
    createdAt?: { gte?: Date; lte?: Date }
  } = {}

  if (tenantId) where.tenantId = tenantId
  if (businessId) where.businessId = businessId
  if (userId) where.userId = userId
  if (action) where.action = action
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) {
      const t = new Date(to)
      t.setHours(23, 59, 59, 999)
      where.createdAt.lte = t
    }
  }

  const rows = await db.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      business: { select: { id: true, name: true } },
      tenant: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, -1) : rows
  const nextCursor = hasMore ? items[items.length - 1]?.id : null

  const currentTenantId = await getCurrentTenantId()

  return NextResponse.json({
    items: items.map(a => {
      let changes: unknown = null
      try {
        changes = a.changes ? JSON.parse(a.changes) : null
      } catch {
        changes = a.changes
      }
      return {
        id: a.id,
        createdAt: a.createdAt,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        description: a.description,
        changes,
        ipAddress: a.ipAddress,
        user: a.user
          ? { id: a.user.id, name: a.user.name, email: a.user.email }
          : null,
        business: a.business
          ? { id: a.business.id, name: a.business.name }
          : null,
        tenant: a.tenant
          ? { id: a.tenant.id, name: a.tenant.name, slug: a.tenant.slug }
          : null,
      }
    }),
    nextCursor,
    hasMore,
    filters: {
      tenantId,
      businessId,
      userId,
      action,
      entityType,
      entityId,
      from,
      to,
    },
    // Convenience: include the current admin's tenant so the frontend can
    // default the filter to the user's current tenant scope.
    currentTenantId,
  })
}
