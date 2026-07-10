import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId } from '@/lib/auth'

// GET /api/custom-fields?doctype=xxx
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const doctype = searchParams.get('doctype')

  const fields = await db.customFieldDefinition.findMany({
    where: { businessId, ...(doctype ? { doctype } : {}) },
    orderBy: [{ tab: 'asc' }, { section: 'asc' }, { position: 'asc' }],
  })

  // Group by tab → section → fields
  const grouped: Record<string, Record<string, typeof fields>> = {}
  for (const f of fields) {
    if (!grouped[f.tab]) grouped[f.tab] = {}
    if (!grouped[f.tab][f.section]) grouped[f.tab][f.section] = []
    grouped[f.tab][f.section].push(f)
  }

  return NextResponse.json({ fields, grouped })
}

// POST
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const field = await db.customFieldDefinition.create({
    data: {
      businessId,
      doctype: body.doctype,
      tab: body.tab || 'General',
      section: body.section || 'Details',
      fieldKey: body.fieldKey,
      label: body.label,
      labelAr: body.labelAr || null,
      type: body.type || 'TEXT',
      options: body.options ? JSON.stringify(body.options) : null,
      defaultValue: body.defaultValue || null,
      isRequired: body.isRequired || false,
      isVisible: body.isVisible !== false,
      position: body.position || 0,
    },
  })
  return NextResponse.json(field)
}

// PUT
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await req.json()
  const field = await db.customFieldDefinition.update({
    where: { id },
    data: {
      doctype: body.doctype, tab: body.tab, section: body.section,
      fieldKey: body.fieldKey, label: body.label, labelAr: body.labelAr || null,
      type: body.type, options: body.options ? JSON.stringify(body.options) : null,
      defaultValue: body.defaultValue, isRequired: body.isRequired, isVisible: body.isVisible,
      position: body.position,
    },
  })
  return NextResponse.json(field)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.customFieldDefinition.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
