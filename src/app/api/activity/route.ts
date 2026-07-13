import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, AuthError } from '@/lib/auth'

// GET /api/activity?entityType=SALES_INVOICE&entityId=xxx
// Returns the activity log for a specific entity (or all entities in the
// business if no filter provided).
export async function GET(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '50', 10), 1),
    200
  )

  const where: { businessId: string; entityType?: string; entityId?: string } = { businessId }
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId

  const activities = await db.activityLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json(
    activities.map(a => {
      let metadata: unknown = null
      try {
        metadata = a.metadata ? JSON.parse(a.metadata) : null
      } catch {
        metadata = a.metadata
      }
      return {
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        message: a.message,
        metadata,
        createdAt: a.createdAt,
        user: a.user
          ? { id: a.user.id, name: a.user.name, email: a.user.email }
          : null,
      }
    })
  )
}

// POST /api/activity — record an activity log entry
// Body: { entityType, entityId, action, message, metadata? }
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
  if (!body.entityType || !body.entityId || !body.action || !body.message) {
    return NextResponse.json(
      { error: 'entityType, entityId, action, and message are required' },
      { status: 400 }
    )
  }

  // Get the current user (required for the activity log FK)
  // We re-import getSession lazily to avoid a top-level dependency
  const { getSession } = await import('@/lib/auth')
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const entry = await db.activityLog.create({
    data: {
      businessId,
      userId: session.userId,
      entityType: body.entityType,
      entityId: body.entityId,
      action: body.action,
      message: body.message,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  return NextResponse.json(entry, { status: 201 })
}
