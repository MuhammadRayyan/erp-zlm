import { NextRequest, NextResponse } from 'next/server'
import { ensureBusinessId, getSession, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// Dashboard widget configuration per user per business.
// Stored in AppSetting with key `dashboard_config_{businessId}_{userId}`.
export interface DashboardWidget {
  id: string
  type: string // e.g. 'kpi-receivables', 'chart-revenue', 'list-overdue'
  title: string
  position: { x: number; y: number; w: number; h: number }
  config?: Record<string, unknown>
  isVisible: boolean
}

export interface DashboardConfig {
  layout: DashboardWidget[]
  refreshIntervalSec?: number
  defaultDateRange?: 'today' | 'week' | 'month' | 'quarter' | 'year'
}

const DEFAULTS: DashboardConfig = {
  layout: [
    {
      id: 'kpi-receivables',
      type: 'kpi-receivables',
      title: 'Total Receivables',
      position: { x: 0, y: 0, w: 3, h: 1 },
      isVisible: true,
    },
    {
      id: 'kpi-payables',
      type: 'kpi-payables',
      title: 'Total Payables',
      position: { x: 3, y: 0, w: 3, h: 1 },
      isVisible: true,
    },
    {
      id: 'kpi-month-income',
      type: 'kpi-month-income',
      title: 'Monthly Income',
      position: { x: 6, y: 0, w: 3, h: 1 },
      isVisible: true,
    },
    {
      id: 'kpi-month-expenses',
      type: 'kpi-month-expenses',
      title: 'Monthly Expenses',
      position: { x: 9, y: 0, w: 3, h: 1 },
      isVisible: true,
    },
    {
      id: 'chart-revenue',
      type: 'chart-revenue',
      title: 'Revenue vs Expenses',
      position: { x: 0, y: 1, w: 8, h: 2 },
      isVisible: true,
    },
    {
      id: 'list-overdue',
      type: 'list-overdue',
      title: 'Overdue Invoices',
      position: { x: 8, y: 1, w: 4, h: 2 },
      isVisible: true,
    },
  ],
  refreshIntervalSec: 60,
  defaultDateRange: 'month',
}

function namespace(userId: string): string {
  return `dashboard_config_${userId}`
}

// GET /api/dashboard-config
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
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const stored = await getBusinessSetting<DashboardConfig>(businessId, namespace(session.userId))
  return NextResponse.json({ ...DEFAULTS, ...stored })
}

// POST /api/dashboard-config — save the user's dashboard configuration
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
  const stored =
    (await getBusinessSetting<DashboardConfig>(businessId, namespace(session.userId))) ||
    ({} as Partial<DashboardConfig>)
  const merged: DashboardConfig = {
    ...DEFAULTS,
    ...stored,
    ...body,
    // Always merge layout (not replace) if body only sends partial layout
    layout:
      Array.isArray(body.layout) && body.layout.length > 0
        ? body.layout
        : stored.layout || DEFAULTS.layout,
  }
  await setBusinessSetting(businessId, namespace(session.userId), merged)
  return NextResponse.json(merged)
}
