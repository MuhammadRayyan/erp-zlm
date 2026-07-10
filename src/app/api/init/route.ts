import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedAll } from '@/lib/seed-all'

// POST /api/init — seed all initial data (plans, admin, test tenants)
export async function POST() {
  try {
    await seedAll()
    return NextResponse.json({ ok: true, message: 'Seed data created' })
  } catch (e) {
    console.error('Seed error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GET /api/init — check if initialized
export async function GET() {
  const seeded = await db.appSetting.findUnique({ where: { key: 'seeded' } })
  const tenantCount = await db.tenant.count()
  const planCount = await db.plan.count()
  return NextResponse.json({
    initialized: !!seeded?.value || (tenantCount > 0 && planCount > 0),
    tenantCount,
    planCount,
  })
}
