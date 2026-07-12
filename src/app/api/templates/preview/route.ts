import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureBusinessId, getCurrentTenantId } from '@/lib/auth'
import { renderTemplate, wrapHtmlForPdf } from '@/lib/template-renderer'
import { toNumber, money } from '@/lib/decimal'

// POST /api/templates/preview — render template with real data
export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  

  const body = await req.json()
  const { templateId, doctype, documentId, htmlContent, cssContent } = body

  // Get template
  let template
  if (templateId) {
    template = await db.pdfTemplate.findFirst({ where: { id: templateId, businessId } })
  } else if (htmlContent) {
    template = { htmlContent, cssContent: cssContent || '' }
  } else {
    template = await db.pdfTemplate.findFirst({ where: { businessId, doctype, isDefault: true } })
    if (!template) template = await db.pdfTemplate.findFirst({ where: { businessId, doctype } })
  }

  if (!template) return NextResponse.json({ error: 'No template found' }, { status: 404 })

  // Build data context based on doctype
  const business = await db.business.findUnique({ where: { id: businessId } })
  let data: Record<string, unknown> = { business }

  if (doctype === 'SALES_INVOICE' && documentId) {
    const inv = await db.salesInvoice.findUnique({
      where: { id: documentId },
      include: { party: true, lines: { include: { taxRate: true }, orderBy: { position: 'asc' } } },
    })
    if (inv) {
      data = {
        business,
        party: inv.party,
        invoice: {
          number: inv.number, date: inv.date, dueDate: inv.dueDate, reference: inv.reference,
          status: inv.status, subtotal: toNumber(inv.subtotal), totalDiscount: toNumber(inv.totalDiscount),
          totalTax: toNumber(inv.totalTax), total: toNumber(inv.total), amountPaid: toNumber(inv.amountPaid),
          notes: inv.notes, terms: inv.terms, currency: inv.currency,
          balanceDue: toNumber(money(inv.total).minus(money(inv.amountPaid))),
        },
        lines: inv.lines.map(l => ({
          description: l.description, quantity: toNumber(l.quantity), unitPrice: toNumber(l.unitPrice),
          discount: toNumber(l.discount), taxRate: l.taxRate ? toNumber(l.taxRate.rate) : 0,
          total: toNumber(money(l.lineTotal).plus(money(l.lineTax))),
        })),
        documentType: 'Invoice',
      }
    }
  }

  const html = renderTemplate(template.htmlContent, data)
  const fullHtml = wrapHtmlForPdf(html, template.cssContent)

  return NextResponse.json({ html: fullHtml })
}
