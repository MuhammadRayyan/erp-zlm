import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ensureBusinessId,
  getCurrentTenantId,
  getSession,
  AuthError,
} from '@/lib/auth'
import { getBusinessSetting } from '@/lib/settings'
import { renderTemplate, wrapHtmlForPdf } from '@/lib/template-renderer'
import { toNumber, money } from '@/lib/decimal'
import type { EmailConfig } from '../config/route'

// Same dynamic loader pattern as /api/email/send — nodemailer is optional.
async function loadNodemailer(): Promise<any | null> {
  try {
    const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>
    const mod = await dynamicImport('nodemailer')
    return mod.default || mod
  } catch {
    return null
  }
}

// POST /api/email/send-invoice
// Body: { invoiceId, to?, cc?, bcc?, subject?, message?, templateId? }
// If `to` is omitted, the invoice party's email is used (must be present).
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
  const tenantId = await getCurrentTenantId()

  const body = await req.json()
  const { invoiceId, to, cc, bcc, subject, message, templateId } = body || {}
  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
  }

  // Load the invoice (verify tenant isolation)
  const invoice = await db.salesInvoice.findFirst({
    where: { id: invoiceId, businessId },
    include: {
      party: true,
      lines: { include: { taxRate: true }, orderBy: { position: 'asc' } },
    },
  })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const recipient = to || invoice.party.email
  if (!recipient) {
    return NextResponse.json(
      { error: 'No recipient email. The invoice party has no email set; provide `to` in the body.' },
      { status: 400 }
    )
  }

  const business = await db.business.findUnique({ where: { id: businessId } })
  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  // Load the invoice template (custom or default for SALES_INVOICE)
  let template = templateId
    ? await db.pdfTemplate.findFirst({ where: { id: templateId, businessId } })
    : null
  if (!template) {
    template = await db.pdfTemplate.findFirst({
      where: { businessId, doctype: 'SALES_INVOICE', isDefault: true },
    })
  }
  if (!template) {
    template = await db.pdfTemplate.findFirst({
      where: { businessId, doctype: 'SALES_INVOICE' },
    })
  }
  if (!template) {
    return NextResponse.json(
      { error: 'No SALES_INVOICE PDF template configured for this business' },
      { status: 400 }
    )
  }

  // Build the data context (matches /api/templates/preview)
  const data = {
    business,
    party: invoice.party,
    invoice: {
      number: invoice.number,
      date: invoice.date,
      dueDate: invoice.dueDate,
      reference: invoice.reference,
      status: invoice.status,
      subtotal: toNumber(invoice.subtotal),
      totalDiscount: toNumber(invoice.totalDiscount),
      totalTax: toNumber(invoice.totalTax),
      total: toNumber(invoice.total),
      amountPaid: toNumber(invoice.amountPaid),
      notes: invoice.notes,
      terms: invoice.terms,
      currency: invoice.currency,
      balanceDue: toNumber(money(invoice.total).minus(money(invoice.amountPaid))),
    },
    lines: invoice.lines.map(l => ({
      description: l.description,
      quantity: toNumber(l.quantity),
      unitPrice: toNumber(l.unitPrice),
      discount: toNumber(l.discount),
      taxRate: l.taxRate ? toNumber(l.taxRate.rate) : 0,
      total: toNumber(money(l.lineTotal).plus(money(l.lineTax))),
    })),
    documentType: 'Invoice',
  }

  const htmlBody = renderTemplate(template.htmlContent, data)
  const fullHtml = wrapHtmlForPdf(htmlBody, template.cssContent)

  // Wrap the rendered invoice in a basic email shell with the user's message
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto;">
      ${message ? `<div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; white-space: pre-wrap;">${escapeHtml(message)}</div>` : ''}
      <div style="margin-bottom: 16px; font-size: 14px; color: #4b5563;">
        Please find your invoice below. You can also print or save it as a PDF using your browser's print function.
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      ${fullHtml}
    </div>
  `

  const emailSubject = subject || `Invoice ${invoice.number} from ${business.name}`
  const textFallback = `${emailSubject}\n\nInvoice ${invoice.number} for ${invoice.party.name}\nTotal: ${invoice.currency} ${toNumber(invoice.total)}\nBalance Due: ${invoice.currency} ${toNumber(money(invoice.total).minus(money(invoice.amountPaid)))}\n\n${message || ''}`

  const config =
    (await getBusinessSetting<EmailConfig>(businessId, 'email_config')) || null
  if (!config || !config.enabled || !config.host || !config.fromAddress) {
    return NextResponse.json(
      { error: 'Email not configured. Set up SMTP in Settings → Email first.' },
      { status: 400 }
    )
  }

  const nodemailer = await loadNodemailer()
  if (!nodemailer) {
    console.warn(
      '[email/send-invoice] nodemailer is not installed — recording attempt without sending.',
      { businessId, invoiceId, recipient }
    )
    await db.activityLog
      .create({
        data: {
          businessId,
          userId: session.userId,
          entityType: 'SALES_INVOICE',
          entityId: invoice.id,
          action: 'EMAILED',
          message: `Invoice ${invoice.number} emailed to ${recipient} — NOT delivered (nodemailer not installed)`,
          metadata: JSON.stringify({ to: recipient, subject: emailSubject }),
        },
      })
      .catch(() => {})
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        warning: 'nodemailer is not installed — email body was logged but not delivered.',
      },
      { status: 200 }
    )
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.username
        ? { user: config.username, pass: config.password }
        : undefined,
    })

    const info = await transporter.sendMail({
      from: config.fromName
        ? `"${config.fromName}" <${config.fromAddress}>`
        : config.fromAddress,
      to: recipient,
      cc: cc || undefined,
      bcc: bcc || undefined,
      replyTo: config.replyTo || undefined,
      subject: emailSubject,
      html: emailHtml,
      text: textFallback,
    })

    // Activity log on the invoice
    await db.activityLog
      .create({
        data: {
          businessId,
          userId: session.userId,
          entityType: 'SALES_INVOICE',
          entityId: invoice.id,
          action: 'EMAILED',
          message: `Invoice ${invoice.number} emailed to ${recipient}`,
          metadata: JSON.stringify({
            to: recipient,
            cc,
            bcc,
            subject: emailSubject,
            messageId: info?.messageId,
          }),
        },
      })
      .catch(() => {})

    // Audit log (best-effort)
    if (tenantId) {
      await db.auditLog
        .create({
          data: {
            businessId,
            tenantId,
            userId: session.userId,
            action: 'INVOICE_EMAILED',
            entityType: 'SALES_INVOICE',
            entityId: invoice.id,
            description: `Emailed invoice ${invoice.number} to ${recipient}`,
          },
        })
        .catch(() => {})
    }

    return NextResponse.json({ ok: true, sent: true, messageId: info?.messageId })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to send invoice email: ${(e as Error).message}` },
      { status: 500 }
    )
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br/>')
}
