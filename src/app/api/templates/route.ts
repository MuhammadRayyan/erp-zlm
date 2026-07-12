import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId , AuthError } from '@/lib/auth'

// GET /api/templates?doctype=xxx
export async function GET(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const { searchParams } = new URL(req.url)
  const doctype = searchParams.get('doctype')

  const templates = await db.pdfTemplate.findMany({
    where: { businessId, ...(doctype ? { doctype } : {}) },
    orderBy: { isDefault: 'desc' },
  })

  return NextResponse.json(templates)
}

// POST — create template
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()

  if (body.isDefault) {
    await db.pdfTemplate.updateMany({ where: { businessId, doctype: body.doctype, isDefault: true }, data: { isDefault: false } })
  }

  const template = await db.pdfTemplate.create({
    data: {
      businessId,
      name: body.name,
      doctype: body.doctype,
      htmlContent: body.htmlContent,
      cssContent: body.cssContent || '',
      isDefault: body.isDefault || false,
    },
  })
  return NextResponse.json(template)
}

// PUT
export async function PUT(req: NextRequest) {
  let businessId: string
  try { businessId = await ensureBusinessId() } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await req.json()

  if (body.isDefault) {
    await db.pdfTemplate.updateMany({ where: { businessId, doctype: body.doctype, isDefault: true }, data: { isDefault: false } })
  }

  const template = await db.pdfTemplate.update({
    where: { id },
    data: {
      name: body.name,
      htmlContent: body.htmlContent,
      cssContent: body.cssContent,
      isDefault: body.isDefault,
    },
  })
  return NextResponse.json(template)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const template = await db.pdfTemplate.findFirst({ where: { id, businessId } })
  if (template?.isSystem) {
    return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 400 })
  }

  await db.pdfTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
