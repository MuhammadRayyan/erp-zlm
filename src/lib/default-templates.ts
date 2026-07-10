// Default HTML/CSS templates for PDF documents
// These use Handlebars-style {{variable}} placeholders

export const DEFAULT_TEMPLATE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
.invoice-container { max-width: 800px; margin: 0 auto; padding: 40px; }
.invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #16a34a; padding-bottom: 20px; }
.business-info h1 { font-size: 24px; color: #16a34a; margin-bottom: 8px; }
.business-info p { margin-bottom: 2px; color: #555; font-size: 11px; }
.business-info .trn { font-weight: bold; color: #1a1a1a; margin-top: 4px; }
.invoice-meta { text-align: right; }
.invoice-meta h2 { font-size: 28px; color: #1a1a1a; text-transform: uppercase; letter-spacing: 2px; }
.invoice-meta .invoice-number { font-size: 14px; color: #16a34a; font-weight: bold; margin-top: 4px; }
.invoice-meta .dates { margin-top: 8px; font-size: 11px; color: #555; }
.invoice-meta .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 8px; }
.status-POSTED { background: #dcfce7; color: #166534; }
.status-PAID { background: #dbeafe; color: #1e40af; }
.status-OVERDUE { background: #fee2e2; color: #991b1b; }
.status-DRAFT { background: #f3f4f6; color: #374151; }
.parties { display: flex; justify-content: space-between; margin-bottom: 25px; }
.party-block { flex: 1; }
.party-block h3 { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; letter-spacing: 1px; }
.party-block .party-name { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
.party-block .party-details { font-size: 11px; color: #555; }
.party-block .party-trn { font-weight: bold; margin-top: 4px; }
.items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
.items-table th { background: #f0fdf4; color: #166534; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #16a34a; }
.items-table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
.items-table .text-right { text-align: right; }
.items-table .text-center { text-align: center; }
.items-table .item-desc { font-weight: 500; }
.totals-section { display: flex; justify-content: flex-end; margin-bottom: 30px; }
.totals-table { width: 300px; }
.totals-table tr td { padding: 6px 0; font-size: 11px; }
.totals-table tr td:last-child { text-align: right; font-weight: 500; }
.totals-table .grand-total td { border-top: 2px solid #16a34a; padding-top: 12px; font-size: 14px; font-weight: bold; color: #16a34a; }
.notes-section { margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 6px; font-size: 11px; color: #555; }
.notes-section h4 { font-size: 10px; text-transform: uppercase; color: #888; margin-bottom: 6px; }
.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #888; }
.amount-in-words { margin-top: 10px; font-size: 11px; color: #555; font-style: italic; }
.vat-summary { margin-top: 15px; padding: 10px; background: #f0fdf4; border-radius: 4px; font-size: 10px; }
.vat-summary table { width: 100%; }
.vat-summary th, .vat-summary td { padding: 4px 8px; text-align: right; }
.vat-summary th { text-align: left; color: #166534; }
`

export const DEFAULT_INVOICE_TEMPLATE = `
<div class="invoice-container">
  <div class="invoice-header">
    <div class="business-info">
      <h1>{{business.name}}</h1>
      {{#if business.legalName}}<p>{{business.legalName}}</p>{{/if}}
      {{#if business.addressLine1}}<p>{{business.addressLine1}}</p>{{/if}}
      {{#if business.city}}<p>{{business.city}}{{#if business.state}}, {{business.state}}{{/if}} {{business.country}}</p>{{/if}}
      {{#if business.email}}<p>{{business.email}}</p>{{/if}}
      {{#if business.phone}}<p>Tel: {{business.phone}}</p>{{/if}}
      {{#if business.trn}}<p class="trn">TRN: {{business.trn}}</p>{{/if}}
    </div>
    <div class="invoice-meta">
      <h2>{{documentType}}</h2>
      <div class="invoice-number">{{invoice.number}}</div>
      <div class="dates">
        <div>Date: {{formatDate invoice.date}}</div>
        {{#if invoice.dueDate}}<div>Due: {{formatDate invoice.dueDate}}</div>{{/if}}
        {{#if invoice.reference}}<div>Ref: {{invoice.reference}}</div>{{/if}}
      </div>
      <div class="status status-{{invoice.status}}">{{invoice.status}}</div>
    </div>
  </div>

  <div class="parties">
    <div class="party-block">
      <h3>Bill To</h3>
      <div class="party-name">{{party.name}}</div>
      {{#if party.addressLine1}}<div class="party-details">{{party.addressLine1}}</div>{{/if}}
      {{#if party.city}}<div class="party-details">{{party.city}}{{#if party.state}}, {{party.state}}{{/if}} {{party.country}}</div>{{/if}}
      {{#if party.email}}<div class="party-details">{{party.email}}</div>{{/if}}
      {{#if party.phone}}<div class="party-details">{{party.phone}}</div>{{/if}}
      {{#if party.trn}}<div class="party-trn">TRN: {{party.trn}}</div>{{/if}}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 40px;">#</th>
        <th>Description</th>
        <th class="text-center" style="width: 70px;">Qty</th>
        <th class="text-right" style="width: 90px;">Price</th>
        <th class="text-center" style="width: 60px;">Disc%</th>
        <th class="text-right" style="width: 90px;">Tax%</th>
        <th class="text-right" style="width: 100px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td>{{add @index 1}}</td>
        <td class="item-desc">{{this.description}}</td>
        <td class="text-center">{{this.quantity}}</td>
        <td class="text-right">{{formatMoney this.unitPrice}}</td>
        <td class="text-center">{{this.discount}}</td>
        <td class="text-center">{{this.taxRate}}</td>
        <td class="text-right">{{formatMoney this.total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals-section">
    <table class="totals-table">
      <tr><td>Subtotal</td><td>{{formatMoney invoice.subtotal}}</td></tr>
      {{#if invoice.totalDiscount}}<tr><td>Discount</td><td>- {{formatMoney invoice.totalDiscount}}</td></tr>{{/if}}
      <tr><td>VAT</td><td>{{formatMoney invoice.totalTax}}</td></tr>
      <tr class="grand-total"><td>Total {{invoice.currency}}</td><td>{{formatMoney invoice.total}}</td></tr>
      {{#if invoice.amountPaid}}<tr><td>Paid</td><td>- {{formatMoney invoice.amountPaid}}</td></tr>{{/if}}
      {{#if invoice.balanceDue}}<tr><td>Balance Due</td><td>{{formatMoney invoice.balanceDue}}</td></tr>{{/if}}
    </table>
  </div>

  {{#if invoice.notes}}
  <div class="notes-section">
    <h4>Notes</h4>
    <p>{{invoice.notes}}</p>
  </div>
  {{/if}}

  {{#if invoice.terms}}
  <div class="notes-section">
    <h4>Terms & Conditions</h4>
    <p>{{invoice.terms}}</p>
  </div>
  {{/if}}

  <div class="footer">
    <p>Thank you for your business!</p>
    <p>This is a computer-generated document and does not require a signature.</p>
  </div>
</div>
`

export const DEFAULT_QUOTATION_TEMPLATE = DEFAULT_INVOICE_TEMPLATE.replace(/invoice/g, 'quotation').replace(/Invoice/g, 'Quotation')
export const DEFAULT_CREDIT_NOTE_TEMPLATE = DEFAULT_INVOICE_TEMPLATE.replace(/invoice/g, 'creditNote').replace(/Invoice/g, 'Credit Note').replace('Bill To', 'Credit To')
export const DEFAULT_DELIVERY_NOTE_TEMPLATE = `
<div class="invoice-container">
  <div class="invoice-header">
    <div class="business-info">
      <h1>{{business.name}}</h1>
      {{#if business.addressLine1}}<p>{{business.addressLine1}}</p>{{/if}}
      {{#if business.city}}<p>{{business.city}}, {{business.state}} {{business.country}}</p>{{/if}}
      {{#if business.trn}}<p class="trn">TRN: {{business.trn}}</p>{{/if}}
    </div>
    <div class="invoice-meta">
      <h2>Delivery Note</h2>
      <div class="invoice-number">{{deliveryNote.number}}</div>
      <div class="dates"><div>Date: {{formatDate deliveryNote.date}}</div></div>
    </div>
  </div>
  <div class="parties">
    <div class="party-block">
      <h3>Deliver To</h3>
      <div class="party-name">{{party.name}}</div>
      {{#if party.shippingAddress1}}<div class="party-details">{{party.shippingAddress1}}</div>{{/if}}
      {{#if party.shippingCity}}<div class="party-details">{{party.shippingCity}}, {{party.shippingState}}</div>{{/if}}
    </div>
    <div class="party-block" style="text-align: right;">
      <h3>Received By</h3>
      <div style="margin-top: 40px; border-top: 1px solid #333; width: 200px; padding-top: 4px; font-size: 10px;">Name & Signature</div>
    </div>
  </div>
  <table class="items-table">
    <thead><tr><th style="width: 40px;">#</th><th>Description</th><th class="text-center" style="width: 100px;">Quantity</th><th class="text-center" style="width: 120px;">Received</th></tr></thead>
    <tbody>
      {{#each lines}}
      <tr><td>{{add @index 1}}</td><td>{{this.description}}</td><td class="text-center">{{this.quantity}}</td><td class="text-center">________</td></tr>
      {{/each}}
    </tbody>
  </table>
  <div class="footer"><p>Goods received in good condition.</p></div>
</div>
`
