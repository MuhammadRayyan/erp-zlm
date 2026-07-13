import { NextRequest, NextResponse } from 'next/server'
import { ensureBusinessId, getSession, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Saved views: per-user list filters for grids (invoices, bills, etc.).
// Stored in AppSetting with key `saved_views_{businessId}_{userId}`.
export interface SavedView {
  id: string
  name: string
  entity: string // e.g. 'invoices', 'bills', 'payments'
  filters: Record<string, unknown>
  columns?: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  isShared: boolean
  createdAt: string
  updatedAt: string
}

function namespace(userId: string): string {
  return `saved_views_${userId}`
}

// GET /api/saved-views?entity=invoices
// Returns the current user's saved views for the current business
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entity = searchParams.get('entity')

  const items = (await getBusinessSetting<SavedView[]>(businessId, namespace(session.userId))) || []
  const filtered = entity ? items.filter(v => v.entity === entity) : items
  return NextResponse.json(filtered)
}

// POST /api/saved-views — create or update
// Body (new): { name, entity, filters, columns?, sortBy?, sortDir?, isShared? }
// Body (update): { id, name?, filters?, columns?, sortBy?, sortDir?, isShared? }
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const items = (await getBusinessSetting<SavedView[]>(businessId, namespace(session.userId))) || []
  const now = new Date().toISOString()

  if (body.id) {
    const idx = items.findIndex(v => v.id === body.id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const updated: SavedView = {
      ...items[idx],
      ...body,
      id: items[idx].id,
      updatedAt: now,
    }
    items[idx] = updated
    await setBusinessSetting(businessId, namespace(session.userId), items)
    return NextResponse.json(updated)
  }

  if (!body.name || !body.entity) {
    return NextResponse.json({ error: 'name and entity are required' }, { status: 400 })
  }

  const newView: SavedView = {
    id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: body.name,
    entity: body.entity,
    filters: body.filters || {},
    columns: body.columns,
    sortBy: body.sortBy,
    sortDir: body.sortDir,
    isShared: body.isShared === true,
    createdAt: now,
    updatedAt: now,
  }
  items.push(newView)
  await setBusinessSetting(businessId, namespace(session.userId), items)
  return NextResponse.json(newView, { status: 201 })
}

// DELETE /api/saved-views?id=xxx
export async function DELETE(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const items = (await getBusinessSetting<SavedView[]>(businessId, namespace(session.userId))) || []
  const remaining = items.filter(v => v.id !== id)
  await setBusinessSetting(businessId, namespace(session.userId), remaining)
  return NextResponse.json({ ok: true })
}
