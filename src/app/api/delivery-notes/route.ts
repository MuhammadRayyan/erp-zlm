import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentBusinessId } from '@/lib/business-context'
import { toNumber } from '@/lib/decimal'

// GET /api/delivery-notes
export async function GET(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    const dn = await db.deliveryNote.findUnique({
      where: { id },
      include: { party: true, lines: { orderBy: { position: 'asc' } } },
    })
    if (!dn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      ...dn,
      lines: dn.lines.map(l => ({ ...l, quantity: toNumber(l.quantity) })),
    })
  }

  const dns = await db.deliveryNote.findMany({
    where: { businessId },
    include: { party: { select: { name: true } } },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(dns.map(d => ({ id: d.id, number: d.number, date: d.date, partyName: d.party.name, status: d.status })))
}

// POST
export async function POST(req: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) return NextResponse.json({ error: 'No business' }, { status: 400 })

  const body = await req.json()
  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 400 })

  const number = `${business.deliveryNotePrefix}${String(business.nextDeliveryNoteNumber).padStart(6, '0')}`

  const dn = await db.deliveryNote.create({
    data: {
      businessId, number,
      date: new Date(body.date),
      partyId: body.partyId,
      invoiceId: body.invoiceId || null,
      reference: body.reference || null,
      status: 'DRAFT',
      notes: body.notes || null,
      lines: {
        create: body.lines.map((l: { description: string; quantity: number; itemId?: string }, i: number) => ({
          description: l.description, quantity: l.quantity, itemId: l.itemId || null, position: i,
        })),
      },
    },
    include: { lines: true },
  })

  await db.business.update({ where: { id: businessId }, data: { nextDeliveryNoteNumber: { increment: 1 } } })
  return NextResponse.json(dn)
}

// DELETE
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await db.deliveryNote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
