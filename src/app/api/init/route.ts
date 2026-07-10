import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { seedDefaultData } from '@/lib/seed'

// POST /api/init — seed initial data
export async function POST(req: NextRequest) {
  try {
    const business = await seedDefaultData()
    return NextResponse.json({ ok: true, businessId: business.id, businessName: business.name })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

// GET /api/init — check if initialized
export async function GET() {
  const business = await db.business.findFirst()
  const accountCount = business ? await db.account.count({ where: { businessId: business.id } }) : 0
  return NextResponse.json({
    initialized: !!business && accountCount > 0,
    businessId: business?.id || null,
    businessName: business?.name || null,
  })
}
