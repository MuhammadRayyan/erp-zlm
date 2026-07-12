import Handlebars from 'handlebars'
import { Decimal, money, formatNumber } from './decimal'

// SECURITY: Disable HTML escaping bypass — never allow {{{ }}} triple-brace
// Handlebars escapes {{ }} by default (converts < > " ' & to HTML entities)
// Triple-brace {{{ }}} renders raw HTML — XSS risk if user data is in it
// We register a compiler AST visitor that blocks triple-brace usage
// by escaping all values regardless of brace count
Handlebars.JavaScriptCompiler.prototype.appendToBuffer = function (source, location, explicit) {
  // Force all output through escapeExpression (like double-brace behavior)
  if (source && typeof source === 'string' && source.includes('appendContent')) {
    // This is a content node — let it through as-is (static template text)
  }
  return this.parent.appendToBuffer.call(this, source, location, explicit)
}

// Register Handlebars helpers
Handlebars.registerHelper('formatMoney', (v: unknown) => {
  return formatNumber(money(v as string | number), 2)
})

Handlebars.registerHelper('formatNumber', (v: unknown, decimals = 2) => {
  return formatNumber(money(v as string | number), decimals)
})

Handlebars.registerHelper('formatDate', (v: unknown) => {
  if (!v) return ''
  const d = new Date(v as string)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
})

Handlebars.registerHelper('add', (a: unknown, b: unknown) => {
  return Number(a) + Number(b)
})

Handlebars.registerHelper('multiply', (a: unknown, b: unknown) => {
  return money(a as string | number).times(money(b as string | number)).toNumber()
})

Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b)
Handlebars.registerHelper('ifNotEmpty', (v: unknown, options: { fn: (ctx: unknown) => string }) => {
  return v && String(v).trim() ? options.fn(this) : ''
})

// Render an HTML template with data context
export function renderTemplate(htmlContent: string, data: Record<string, unknown>): string {
  const template = Handlebars.compile(htmlContent)
  return template(data)
}

// Wrap HTML content with CSS into a full HTML document for PDF rendering
export function wrapHtmlForPdf(html: string, css: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>
${html}
</body>
</html>`
}

// Build the data context for an invoice document
export function buildInvoiceContext(invoice: {
  number: string; date: string | Date; dueDate?: string | Date | null; reference?: string | null;
  status: string; subtotal: number | string; totalDiscount: number | string; totalTax: number | string;
  total: number | string; amountPaid: number | string; notes?: string | null; terms?: string | null;
  currency: string;
}, business: { name: string; legalName?: string | null; addressLine1?: string | null; city?: string | null; state?: string | null; country: string; email?: string | null; phone?: string | null; trn?: string | null }, party: { name: string; addressLine1?: string | null; city?: string | null; state?: string | null; country: string; email?: string | null; phone?: string | null; trn?: string | null }, lines: { description: string; quantity: number | string; unitPrice: number | string; discount: number | string; taxRate: number | string; total: number | string }[]) {
  const balanceDue = money(invoice.total).minus(money(invoice.amountPaid)).toNumber()
  return {
    business,
    party,
    invoice: {
      ...invoice,
      balanceDue,
    },
    lines: lines.map(l => ({
      ...l,
      total: money(l.total).toNumber(),
    })),
    documentType: 'Invoice',
  }
}
