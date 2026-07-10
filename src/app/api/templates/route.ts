import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureDefaultBusiness } from '@/lib/business-context'

// GET /api/templates?doctype=xxx
export async function GET(req: NextRequest) {
  const businessId = await ensureDefaultBusiness()
  

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
  const businessId = await ensureDefaultBusiness()
  

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
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const businessId = await ensureDefaultBusiness()
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

  const template = await db.pdfTemplate.findUnique({ where: { id } })
  if (template?.isSystem) {
    return NextResponse.json({ error: 'System templates cannot be deleted' }, { status: 400 })
  }

  await db.pdfTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
