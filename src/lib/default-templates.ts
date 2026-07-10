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

// ============================================================
// ADDITIONAL PROFESSIONAL TEMPLATES
// Each template is paired with its own self-contained CSS so the
// visual identity travels with the template (not shared globally).
// All templates target A4 print and use the standard data context:
//   business, party, invoice|quotation|creditNote|deliveryNote, lines, documentType
// ============================================================

// ----------------------------------------------------------------
// 2. CLASSIC INVOICE — serif, navy, formal letterhead with border
// ----------------------------------------------------------------
export const CLASSIC_INVOICE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 14mm; }
body { font-family: Georgia, 'Times New Roman', Times, serif; color: #1a1a1a; font-size: 11.5px; line-height: 1.55; }
.classic-container { max-width: 800px; margin: 0 auto; padding: 28px; border: 2px solid #1e3a5f; }
.classic-header { text-align: center; padding-bottom: 16px; border-bottom: 3px double #1e3a5f; margin-bottom: 22px; }
.classic-header h1 { font-size: 26px; color: #1e3a5f; letter-spacing: 1.5px; margin-bottom: 4px; font-weight: bold; }
.classic-header .business-addr { font-size: 11px; color: #444; font-style: italic; line-height: 1.5; }
.classic-header .trn-line { font-size: 11px; margin-top: 5px; color: #1e3a5f; font-weight: bold; letter-spacing: 0.5px; }
.classic-invoice-title { text-align: center; margin: 6px 0 20px; }
.classic-invoice-title h2 { font-size: 30px; color: #1e3a5f; text-transform: uppercase; letter-spacing: 6px; font-weight: bold; }
.classic-meta-row { display: flex; justify-content: space-between; margin-bottom: 22px; padding: 10px 0; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; gap: 16px; }
.classic-meta-row .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; font-style: italic; }
.classic-meta-row .value { font-size: 13px; color: #1e3a5f; font-weight: bold; margin-top: 3px; }
.classic-parties { display: flex; justify-content: space-between; margin-bottom: 22px; gap: 30px; }
.classic-party { flex: 1; }
.classic-party .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; font-style: italic; margin-bottom: 5px; }
.classic-party .name { font-size: 14px; font-weight: bold; color: #1e3a5f; margin-bottom: 4px; }
.classic-party .detail { font-size: 11px; color: #444; line-height: 1.55; }
.classic-party .trn { font-size: 11px; font-weight: bold; color: #1a1a1a; margin-top: 4px; }
.classic-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; border: 1px solid #1e3a5f; }
.classic-table th { background: #1e3a5f; color: #fff; padding: 9px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #1e3a5f; font-weight: bold; }
.classic-table td { padding: 8px; border: 1px solid #ccc; font-size: 11px; }
.classic-table tr:nth-child(even) td { background: #f5f7fa; }
.classic-table .text-right { text-align: right; }
.classic-table .text-center { text-align: center; }
.classic-totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
.classic-totals table { width: 280px; border-collapse: collapse; }
.classic-totals td { padding: 5px 0; font-size: 11.5px; }
.classic-totals td:first-child { color: #444; }
.classic-totals td:last-child { text-align: right; font-weight: 500; }
.classic-totals .grand-total td { border-top: 2px solid #1e3a5f; padding-top: 10px; margin-top: 4px; font-size: 14px; font-weight: bold; color: #1e3a5f; }
.classic-notes { margin-top: 20px; padding: 12px; border-left: 3px solid #1e3a5f; background: #f5f7fa; font-size: 11px; color: #444; margin-bottom: 10px; }
.classic-notes h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #1e3a5f; margin-bottom: 5px; font-style: italic; }
.classic-footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #ccc; text-align: center; font-size: 10px; color: #6b7280; font-style: italic; }
`

export const CLASSIC_INVOICE_TEMPLATE = `
<div class="classic-container">
  <div class="classic-header">
    <h1>{{business.name}}</h1>
    {{#if business.legalName}}<div class="business-addr">{{business.legalName}}</div>{{/if}}
    <div class="business-addr">
      {{#if business.addressLine1}}{{business.addressLine1}}{{/if}}
      {{#if business.city}}{{#if business.addressLine1}}&middot; {{/if}}{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}{{#if business.postalCode}} {{business.postalCode}}{{/if}}{{#if business.country}}, {{business.country}}{{/if}}{{/if}}
    </div>
    <div class="business-addr">
      {{#if business.phone}}Tel: {{business.phone}}{{/if}}{{#if business.email}}{{#if business.phone}} &middot; {{/if}}{{business.email}}{{/if}}
    </div>
    {{#if business.trn}}<div class="trn-line">Tax Registration No. (TRN): {{business.trn}}</div>{{/if}}
  </div>

  <div class="classic-invoice-title"><h2>{{documentType}}</h2></div>

  <div class="classic-meta-row">
    <div>
      <div class="label">Invoice Number</div>
      <div class="value">{{invoice.number}}</div>
    </div>
    <div>
      <div class="label">Invoice Date</div>
      <div class="value">{{formatDate invoice.date}}</div>
    </div>
    <div>
      <div class="label">Due Date</div>
      <div class="value">{{#if invoice.dueDate}}{{formatDate invoice.dueDate}}{{else}}&mdash;{{/if}}</div>
    </div>
    <div>
      <div class="label">Reference</div>
      <div class="value">{{#if invoice.reference}}{{invoice.reference}}{{else}}&mdash;{{/if}}</div>
    </div>
  </div>

  <div class="classic-parties">
    <div class="classic-party">
      <div class="label">From</div>
      <div class="name">{{business.name}}</div>
      {{#if business.addressLine1}}<div class="detail">{{business.addressLine1}}</div>{{/if}}
      {{#if business.city}}<div class="detail">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}</div>{{/if}}
      {{#if business.phone}}<div class="detail">Tel: {{business.phone}}</div>{{/if}}
      {{#if business.email}}<div class="detail">{{business.email}}</div>{{/if}}
    </div>
    <div class="classic-party">
      <div class="label">Bill To</div>
      <div class="name">{{party.name}}</div>
      {{#if party.billingAddress1}}<div class="detail">{{party.billingAddress1}}</div>{{/if}}
      {{#if party.billingCity}}<div class="detail">{{party.billingCity}}{{#if party.billingState}}, {{party.billingState}}{{/if}}</div>{{/if}}
      {{#if party.phone}}<div class="detail">Tel: {{party.phone}}</div>{{/if}}
      {{#if party.email}}<div class="detail">{{party.email}}</div>{{/if}}
      {{#if party.trn}}<div class="trn">TRN: {{party.trn}}</div>{{/if}}
    </div>
  </div>

  <table class="classic-table">
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>Description</th>
        <th class="text-center" style="width: 60px;">Qty</th>
        <th class="text-right" style="width: 90px;">Unit Price</th>
        <th class="text-center" style="width: 55px;">Disc%</th>
        <th class="text-center" style="width: 55px;">VAT%</th>
        <th class="text-right" style="width: 95px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="text-center">{{add @index 1}}</td>
        <td>{{this.description}}</td>
        <td class="text-center">{{this.quantity}}</td>
        <td class="text-right">{{formatMoney this.unitPrice}}</td>
        <td class="text-center">{{this.discount}}</td>
        <td class="text-center">{{this.taxRate}}</td>
        <td class="text-right">{{formatMoney this.total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="classic-totals">
    <table>
      <tr><td>Subtotal</td><td>{{formatMoney invoice.subtotal}}</td></tr>
      {{#if invoice.totalDiscount}}<tr><td>Discount</td><td>- {{formatMoney invoice.totalDiscount}}</td></tr>{{/if}}
      <tr><td>VAT (5%)</td><td>{{formatMoney invoice.totalTax}}</td></tr>
      <tr class="grand-total"><td>Total {{invoice.currency}}</td><td>{{formatMoney invoice.total}}</td></tr>
      {{#if invoice.amountPaid}}<tr><td>Paid</td><td>- {{formatMoney invoice.amountPaid}}</td></tr>{{/if}}
      {{#if invoice.balanceDue}}<tr><td>Balance Due</td><td>{{formatMoney invoice.balanceDue}}</td></tr>{{/if}}
    </table>
  </div>

  {{#if invoice.notes}}
  <div class="classic-notes">
    <h4>Notes</h4>
    <div>{{invoice.notes}}</div>
  </div>
  {{/if}}
  {{#if invoice.terms}}
  <div class="classic-notes">
    <h4>Terms &amp; Conditions</h4>
    <div>{{invoice.terms}}</div>
  </div>
  {{/if}}

  <div class="classic-footer">
    Thank you for your business. This document is computer-generated and requires no signature.
  </div>
</div>
`

// ----------------------------------------------------------------
// 3. UAE COMPLIANT INVOICE — FTA Tax Invoice layout
// ----------------------------------------------------------------
export const UAE_COMPLIANT_INVOICE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 14mm; }
body { font-family: 'Helvetica Neue', Arial, 'Segoe UI', Tahoma, sans-serif; color: #1a1a1a; font-size: 11.5px; line-height: 1.5; }
.uae-container { max-width: 800px; margin: 0 auto; padding: 22px; }
.uae-title-bar { text-align: center; padding: 14px; background: #064e3b; color: #fff; border-radius: 4px; margin-bottom: 16px; }
.uae-title-bar h1 { font-size: 22px; letter-spacing: 4px; font-weight: bold; text-transform: uppercase; }
.uae-title-bar .ar { font-size: 18px; margin-top: 4px; font-family: 'Arial', 'Tahoma', sans-serif; direction: rtl; }
.uae-title-bar .sub { font-size: 10px; margin-top: 6px; opacity: 0.85; letter-spacing: 1px; }
.uae-supplier-customer { display: flex; gap: 14px; margin-bottom: 14px; }
.uae-party-box { flex: 1; padding: 11px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fafafa; }
.uae-party-box .role { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #064e3b; font-weight: bold; margin-bottom: 5px; padding-bottom: 4px; border-bottom: 1px solid #d1d5db; }
.uae-party-box .name { font-size: 13px; font-weight: bold; color: #1a1a1a; margin-bottom: 4px; }
.uae-party-box .addr { font-size: 10.5px; color: #555; line-height: 1.5; }
.uae-party-box .contact { font-size: 10.5px; color: #555; margin-top: 2px; }
.uae-trn-row { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 16px; }
.uae-trn-box { flex: 1; padding: 10px 14px; background: #ecfdf5; border: 1.5px solid #064e3b; border-radius: 4px; }
.uae-trn-box .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #064e3b; font-weight: bold; }
.uae-trn-box .val { font-size: 16px; font-weight: bold; color: #1a1a1a; margin-top: 3px; letter-spacing: 1.5px; font-family: 'Courier New', monospace; }
.uae-trn-box .ar-lbl { font-size: 10px; color: #064e3b; margin-top: 2px; direction: rtl; }
.uae-meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 16px; padding: 10px 14px; background: #f3f4f6; border-radius: 4px; }
.uae-meta-item .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
.uae-meta-item .val { font-size: 12.5px; font-weight: bold; color: #1a1a1a; margin-top: 3px; }
.uae-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #d1d5db; }
.uae-table th { background: #064e3b; color: #fff; padding: 9px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
.uae-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
.uae-table .text-right { text-align: right; }
.uae-table .text-center { text-align: center; }
.uae-totals-wrap { display: flex; gap: 16px; margin-bottom: 14px; align-items: flex-start; }
.uae-vat-breakdown { flex: 1; }
.uae-vat-breakdown h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #064e3b; margin-bottom: 6px; font-weight: bold; }
.uae-vat-table { width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; }
.uae-vat-table th { background: #ecfdf5; color: #064e3b; padding: 6px 8px; text-align: right; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
.uae-vat-table th:first-child { text-align: left; }
.uae-vat-table td { padding: 6px 8px; text-align: right; font-size: 11px; border-bottom: 1px solid #e5e7eb; }
.uae-vat-table td:first-child { text-align: left; }
.uae-vat-table .vat-total-row { background: #ecfdf5; font-weight: bold; }
.uae-grand-totals { width: 240px; }
.uae-grand-totals table { width: 100%; border-collapse: collapse; }
.uae-grand-totals td { padding: 6px 0; font-size: 11.5px; }
.uae-grand-totals td:first-child { color: #555; }
.uae-grand-totals td:last-child { text-align: right; font-weight: 500; }
.uae-grand-totals .grand-total-row td { background: #064e3b; color: #fff; padding: 10px 12px; font-size: 14px; font-weight: bold; border-radius: 4px; }
.uae-amount-words { margin-bottom: 14px; padding: 8px 12px; background: #f9fafb; border-left: 3px solid #064e3b; font-size: 11px; color: #444; font-style: italic; }
.uae-amount-words strong { color: #064e3b; font-style: normal; }
.uae-notes { margin-bottom: 14px; padding: 10px; background: #f9fafb; border-radius: 4px; font-size: 10.5px; color: #555; }
.uae-notes h4 { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1px; color: #064e3b; margin-bottom: 4px; font-weight: bold; }
.uae-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #d1d5db; text-align: center; font-size: 9.5px; color: #6b7280; }
.uae-footer .declaration { font-size: 10px; color: #1a1a1a; margin-bottom: 6px; }
.uae-footer .place { font-weight: 600; color: #064e3b; }
`

export const UAE_COMPLIANT_INVOICE_TEMPLATE = `
<div class="uae-container">
  <div class="uae-title-bar">
    <h1>Tax Invoice</h1>
    <div class="ar">فاتورة ضريبية</div>
    <div class="sub">Issued in accordance with UAE Federal Tax Authority regulations</div>
  </div>

  <div class="uae-supplier-customer">
    <div class="uae-party-box">
      <div class="role">Supplier (Seller)</div>
      <div class="name">{{business.name}}</div>
      {{#if business.legalName}}<div class="addr">{{business.legalName}}</div>{{/if}}
      {{#if business.addressLine1}}<div class="addr">{{business.addressLine1}}</div>{{/if}}
      {{#if business.city}}<div class="addr">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}{{#if business.country}}, {{business.country}}{{/if}}</div>{{/if}}
      {{#if business.phone}}<div class="contact">Tel: {{business.phone}}</div>{{/if}}
      {{#if business.email}}<div class="contact">{{business.email}}</div>{{/if}}
    </div>
    <div class="uae-party-box">
      <div class="role">Customer (Buyer)</div>
      <div class="name">{{party.name}}</div>
      {{#if party.billingAddress1}}<div class="addr">{{party.billingAddress1}}</div>{{/if}}
      {{#if party.billingCity}}<div class="addr">{{party.billingCity}}{{#if party.billingState}}, {{party.billingState}}{{/if}}{{#if party.billingCountry}}, {{party.billingCountry}}{{/if}}</div>{{/if}}
      {{#if party.phone}}<div class="contact">Tel: {{party.phone}}</div>{{/if}}
      {{#if party.email}}<div class="contact">{{party.email}}</div>{{/if}}
    </div>
  </div>

  <div class="uae-trn-row">
    <div class="uae-trn-box">
      <div class="lbl">Supplier TRN</div>
      <div class="val">{{#if business.trn}}{{business.trn}}{{else}}&mdash;{{/if}}</div>
      <div class="ar-lbl">الرقم الضريبي للمورّد</div>
    </div>
    <div class="uae-trn-box">
      <div class="lbl">Customer TRN</div>
      <div class="val">{{#if party.trn}}{{party.trn}}{{else}}&mdash;{{/if}}</div>
      <div class="ar-lbl">الرقم الضريبي للعميل</div>
    </div>
  </div>

  <div class="uae-meta">
    <div class="uae-meta-item">
      <div class="lbl">Invoice No.</div>
      <div class="val">{{invoice.number}}</div>
    </div>
    <div class="uae-meta-item">
      <div class="lbl">Invoice Date</div>
      <div class="val">{{formatDate invoice.date}}</div>
    </div>
    <div class="uae-meta-item">
      <div class="lbl">Due Date</div>
      <div class="val">{{#if invoice.dueDate}}{{formatDate invoice.dueDate}}{{else}}&mdash;{{/if}}</div>
    </div>
    <div class="uae-meta-item">
      <div class="lbl">Reference</div>
      <div class="val">{{#if invoice.reference}}{{invoice.reference}}{{else}}&mdash;{{/if}}</div>
    </div>
    <div class="uae-meta-item">
      <div class="lbl">Currency</div>
      <div class="val">{{invoice.currency}}</div>
    </div>
  </div>

  <table class="uae-table">
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Description of Goods / Services</th>
        <th class="text-center" style="width: 55px;">Qty</th>
        <th class="text-right" style="width: 90px;">Unit Price</th>
        <th class="text-center" style="width: 55px;">VAT%</th>
        <th class="text-right" style="width: 110px;">Line Total ({{invoice.currency}})</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="text-center">{{add @index 1}}</td>
        <td>{{this.description}}</td>
        <td class="text-center">{{this.quantity}}</td>
        <td class="text-right">{{formatMoney this.unitPrice}}</td>
        <td class="text-center">{{this.taxRate}}</td>
        <td class="text-right">{{formatMoney this.total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="uae-totals-wrap">
    <div class="uae-vat-breakdown">
      <h4>VAT Breakdown</h4>
      <table class="uae-vat-table">
        <thead>
          <tr>
            <th>Tax Type</th>
            <th>Taxable Amount ({{invoice.currency}})</th>
            <th>Rate</th>
            <th>VAT Amount ({{invoice.currency}})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Standard-rated supplies</td>
            <td>{{formatMoney invoice.subtotal}}</td>
            <td>5%</td>
            <td>{{formatMoney invoice.totalTax}}</td>
          </tr>
          <tr class="vat-total-row">
            <td>Total VAT</td>
            <td>&mdash;</td>
            <td>&mdash;</td>
            <td>{{formatMoney invoice.totalTax}}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="uae-grand-totals">
      <table>
        <tr><td>Subtotal (before VAT)</td><td>{{formatMoney invoice.subtotal}}</td></tr>
        {{#if invoice.totalDiscount}}<tr><td>Total Discount</td><td>- {{formatMoney invoice.totalDiscount}}</td></tr>{{/if}}
        <tr><td>Total VAT</td><td>{{formatMoney invoice.totalTax}}</td></tr>
        <tr class="grand-total-row"><td>Total Due</td><td>{{formatMoney invoice.total}}</td></tr>
        {{#if invoice.amountPaid}}<tr><td>Amount Paid</td><td>- {{formatMoney invoice.amountPaid}}</td></tr>{{/if}}
        {{#if invoice.balanceDue}}<tr><td>Balance Due</td><td>{{formatMoney invoice.balanceDue}}</td></tr>{{/if}}
      </table>
    </div>
  </div>

  <div class="uae-amount-words">
    <strong>Total in words:</strong>
    {{#if invoice.amountInWords}}{{invoice.amountInWords}} {{invoice.currency}}{{else}}<em>(Configure amount-in-words in template settings)</em>{{/if}}
  </div>

  {{#if invoice.notes}}
  <div class="uae-notes">
    <h4>Notes</h4>
    <div>{{invoice.notes}}</div>
  </div>
  {{/if}}
  {{#if invoice.terms}}
  <div class="uae-notes">
    <h4>Terms &amp; Conditions</h4>
    <div>{{invoice.terms}}</div>
  </div>
  {{/if}}

  <div class="uae-footer">
    <div class="declaration">This is a computer-generated Tax Invoice and does not require a physical signature.</div>
    <div>Place of Supply: <span class="place">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}{{#if business.country}}, {{business.country}}{{/if}}</span></div>
  </div>
</div>
`

// ----------------------------------------------------------------
// 4. MINIMAL INVOICE — black & white, lots of whitespace
// ----------------------------------------------------------------
export const MINIMAL_INVOICE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 22mm; }
body { font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #000; font-size: 12px; line-height: 1.6; }
.minimal-container { max-width: 720px; margin: 0 auto; padding: 24px 0; }
.minimal-header { margin-bottom: 50px; }
.minimal-header .business { font-size: 22px; font-weight: 600; letter-spacing: -0.3px; margin-bottom: 6px; }
.minimal-header .addr { font-size: 11px; color: #555; line-height: 1.6; }
.minimal-title-row { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 16px; border-bottom: 2px solid #000; margin-bottom: 32px; }
.minimal-title-row .doc-title { font-size: 36px; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; }
.minimal-title-row .doc-number { font-size: 14px; font-weight: 600; }
.minimal-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 44px; }
.minimal-meta .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 4px; font-weight: 500; }
.minimal-meta .val { font-size: 12px; font-weight: 500; }
.minimal-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-bottom: 44px; }
.minimal-party .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; font-weight: 500; }
.minimal-party .name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.minimal-party .detail { font-size: 11px; color: #444; line-height: 1.6; }
.minimal-party .trn { font-size: 11px; color: #444; margin-top: 4px; }
.minimal-table { width: 100%; border-collapse: collapse; margin-bottom: 44px; }
.minimal-table th { padding: 0 0 12px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; font-weight: 500; border-bottom: 1px solid #000; }
.minimal-table td { padding: 14px 0; font-size: 12px; border-bottom: 1px solid #eee; vertical-align: top; }
.minimal-table .text-right { text-align: right; }
.minimal-table .text-center { text-align: center; }
.minimal-table .item-desc { font-weight: 500; }
.minimal-totals { display: flex; justify-content: flex-end; margin-bottom: 56px; }
.minimal-totals table { width: 280px; border-collapse: collapse; }
.minimal-totals td { padding: 6px 0; font-size: 12px; }
.minimal-totals td:last-child { text-align: right; }
.minimal-totals .grand-total td { padding-top: 14px; border-top: 2px solid #000; margin-top: 6px; font-size: 16px; font-weight: 600; }
.minimal-section { margin-bottom: 32px; }
.minimal-section .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 8px; font-weight: 500; }
.minimal-section .body { font-size: 11px; color: #444; line-height: 1.7; }
.minimal-footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid #eee; text-align: center; font-size: 10px; color: #888; letter-spacing: 0.5px; }
`

export const MINIMAL_INVOICE_TEMPLATE = `
<div class="minimal-container">
  <div class="minimal-header">
    <div class="business">{{business.name}}</div>
    <div class="addr">
      {{#if business.legalName}}{{business.legalName}}<br>{{/if}}
      {{#if business.addressLine1}}{{business.addressLine1}}{{#if business.addressLine2}}, {{business.addressLine2}}{{/if}}<br>{{/if}}
      {{#if business.city}}{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}{{#if business.postalCode}} {{business.postalCode}}{{/if}}<br>{{/if}}
      {{#if business.country}}{{business.country}}{{/if}}
      {{#if business.phone}}<br>Tel {{business.phone}}{{/if}}
      {{#if business.email}}<br>{{business.email}}{{/if}}
      {{#if business.trn}}<br>VAT TRN: {{business.trn}}{{/if}}
    </div>
  </div>

  <div class="minimal-title-row">
    <div class="doc-title">{{documentType}}</div>
    <div class="doc-number">{{invoice.number}}</div>
  </div>

  <div class="minimal-meta">
    <div>
      <div class="lbl">Date</div>
      <div class="val">{{formatDate invoice.date}}</div>
    </div>
    <div>
      <div class="lbl">Due Date</div>
      <div class="val">{{#if invoice.dueDate}}{{formatDate invoice.dueDate}}{{else}}&mdash;{{/if}}</div>
    </div>
    <div>
      <div class="lbl">Reference</div>
      <div class="val">{{#if invoice.reference}}{{invoice.reference}}{{else}}&mdash;{{/if}}</div>
    </div>
    <div>
      <div class="lbl">Currency</div>
      <div class="val">{{invoice.currency}}</div>
    </div>
  </div>

  <div class="minimal-parties">
    <div class="minimal-party">
      <div class="lbl">From</div>
      <div class="name">{{business.name}}</div>
      {{#if business.addressLine1}}<div class="detail">{{business.addressLine1}}</div>{{/if}}
      {{#if business.city}}<div class="detail">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}</div>{{/if}}
      {{#if business.email}}<div class="detail">{{business.email}}</div>{{/if}}
    </div>
    <div class="minimal-party">
      <div class="lbl">Bill To</div>
      <div class="name">{{party.name}}</div>
      {{#if party.billingAddress1}}<div class="detail">{{party.billingAddress1}}</div>{{/if}}
      {{#if party.billingCity}}<div class="detail">{{party.billingCity}}{{#if party.billingState}}, {{party.billingState}}{{/if}}</div>{{/if}}
      {{#if party.email}}<div class="detail">{{party.email}}</div>{{/if}}
      {{#if party.trn}}<div class="trn">TRN {{party.trn}}</div>{{/if}}
    </div>
  </div>

  <table class="minimal-table">
    <thead>
      <tr>
        <th style="width: 30px;">#</th>
        <th>Description</th>
        <th class="text-center" style="width: 65px;">Qty</th>
        <th class="text-right" style="width: 90px;">Price</th>
        <th class="text-center" style="width: 55px;">Disc%</th>
        <th class="text-right" style="width: 100px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="text-center">{{add @index 1}}</td>
        <td class="item-desc">{{this.description}}</td>
        <td class="text-center">{{this.quantity}}</td>
        <td class="text-right">{{formatMoney this.unitPrice}}</td>
        <td class="text-center">{{this.discount}}</td>
        <td class="text-right">{{formatMoney this.total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="minimal-totals">
    <table>
      <tr><td>Subtotal</td><td>{{formatMoney invoice.subtotal}}</td></tr>
      {{#if invoice.totalDiscount}}<tr><td>Discount</td><td>- {{formatMoney invoice.totalDiscount}}</td></tr>{{/if}}
      <tr><td>VAT</td><td>{{formatMoney invoice.totalTax}}</td></tr>
      <tr class="grand-total"><td>Total</td><td>{{formatMoney invoice.total}}</td></tr>
      {{#if invoice.amountPaid}}<tr><td>Paid</td><td>- {{formatMoney invoice.amountPaid}}</td></tr>{{/if}}
      {{#if invoice.balanceDue}}<tr><td>Balance Due</td><td>{{formatMoney invoice.balanceDue}}</td></tr>{{/if}}
    </table>
  </div>

  {{#if invoice.notes}}
  <div class="minimal-section">
    <div class="lbl">Notes</div>
    <div class="body">{{invoice.notes}}</div>
  </div>
  {{/if}}
  {{#if invoice.terms}}
  <div class="minimal-section">
    <div class="lbl">Terms &amp; Conditions</div>
    <div class="body">{{invoice.terms}}</div>
  </div>
  {{/if}}

  <div class="minimal-footer">Thank you for your business.</div>
</div>
`

// ----------------------------------------------------------------
// 5. BOLD INVOICE — large gradient header, dark totals box
// ----------------------------------------------------------------
export const BOLD_INVOICE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 0; }
body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
.bold-container { max-width: 800px; margin: 0 auto; }
.bold-header { background: #7c3aed; background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: #fff; padding: 36px 40px; display: flex; justify-content: space-between; align-items: center; }
.bold-header .business-info h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
.bold-header .business-info p { font-size: 11px; opacity: 0.92; margin-bottom: 2px; font-weight: 500; }
.bold-header .business-info .trn { display: inline-block; margin-top: 8px; padding: 4px 10px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
.bold-header .doc-info { text-align: right; }
.bold-header .doc-info h2 { font-size: 44px; font-weight: 900; letter-spacing: 4px; line-height: 1; text-transform: uppercase; }
.bold-header .doc-info .num { font-size: 14px; font-weight: 700; margin-top: 6px; opacity: 0.95; }
.bold-header .doc-info .dates { font-size: 10.5px; margin-top: 6px; opacity: 0.85; font-weight: 500; }
.bold-body { padding: 30px 40px 0; }
.bold-parties { display: flex; gap: 20px; margin-bottom: 24px; }
.bold-party { flex: 1; padding: 16px; background: #f5f3ff; border-radius: 8px; border-left: 4px solid #7c3aed; }
.bold-party .role { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed; font-weight: 800; margin-bottom: 6px; }
.bold-party .name { font-size: 15px; font-weight: 700; margin-bottom: 6px; color: #1a1a1a; }
.bold-party .detail { font-size: 11px; color: #555; line-height: 1.55; }
.bold-party .trn { font-size: 11px; font-weight: 700; color: #1a1a1a; margin-top: 6px; padding: 3px 8px; background: #ede9fe; border-radius: 3px; display: inline-block; }
.bold-meta-row { display: flex; gap: 12px; margin-bottom: 24px; }
.bold-meta-pill { flex: 1; padding: 10px 14px; background: #1a1a1a; color: #fff; border-radius: 6px; }
.bold-meta-pill .lbl { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1.5px; color: #d1d5db; font-weight: 700; }
.bold-meta-pill .val { font-size: 13px; font-weight: 700; margin-top: 3px; }
.bold-meta-pill.accent { background: #f59e0b; color: #1a1a1a; }
.bold-meta-pill.accent .lbl { color: #78350f; }
.bold-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
.bold-table th { background: #1a1a1a; color: #fff; padding: 12px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
.bold-table td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11.5px; }
.bold-table tr:nth-child(even) td { background: #fafafa; }
.bold-table .text-right { text-align: right; }
.bold-table .text-center { text-align: center; }
.bold-table .item-desc { font-weight: 700; color: #1a1a1a; }
.bold-totals-section { display: flex; justify-content: flex-end; margin-bottom: 24px; }
.bold-totals-box { width: 320px; background: #1a1a1a; color: #fff; border-radius: 8px; padding: 18px 22px; }
.bold-totals-box table { width: 100%; }
.bold-totals-box td { padding: 5px 0; font-size: 11.5px; }
.bold-totals-box td:last-child { text-align: right; font-weight: 600; }
.bold-totals-box .lbl-light { color: #d1d5db; }
.bold-totals-box .grand-row td { border-top: 1px solid #4b5563; padding-top: 10px; margin-top: 6px; font-size: 17px; font-weight: 800; color: #f59e0b; }
.bold-totals-box .grand-row td:first-child { color: #fff; }
.bold-notes { padding: 14px 18px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 14px; }
.bold-notes h4 { font-size: 9.5px; text-transform: uppercase; letter-spacing: 1.5px; color: #92400e; font-weight: 800; margin-bottom: 5px; }
.bold-notes p { font-size: 11px; color: #78350f; }
.bold-footer { background: #f3f4f6; padding: 18px 40px; text-align: center; font-size: 10px; color: #6b7280; }
.bold-footer strong { color: #7c3aed; }
`

export const BOLD_INVOICE_TEMPLATE = `
<div class="bold-container">
  <div class="bold-header">
    <div class="business-info">
      <h1>{{business.name}}</h1>
      {{#if business.legalName}}<p>{{business.legalName}}</p>{{/if}}
      {{#if business.addressLine1}}<p>{{business.addressLine1}}</p>{{/if}}
      {{#if business.city}}<p>{{business.city}}{{#if business.state}}, {{business.state}}{{/if}} {{business.country}}</p>{{/if}}
      {{#if business.phone}}<p>Tel: {{business.phone}}</p>{{/if}}
      {{#if business.email}}<p>{{business.email}}</p>{{/if}}
      {{#if business.trn}}<span class="trn">TRN: {{business.trn}}</span>{{/if}}
    </div>
    <div class="doc-info">
      <h2>{{documentType}}</h2>
      <div class="num">{{invoice.number}}</div>
      <div class="dates">
        Date: {{formatDate invoice.date}}<br>
        {{#if invoice.dueDate}}Due: {{formatDate invoice.dueDate}}{{/if}}
      </div>
    </div>
  </div>

  <div class="bold-body">
    <div class="bold-meta-row">
      <div class="bold-meta-pill">
        <div class="lbl">Invoice No.</div>
        <div class="val">{{invoice.number}}</div>
      </div>
      <div class="bold-meta-pill">
        <div class="lbl">Date</div>
        <div class="val">{{formatDate invoice.date}}</div>
      </div>
      <div class="bold-meta-pill">
        <div class="lbl">Due</div>
        <div class="val">{{#if invoice.dueDate}}{{formatDate invoice.dueDate}}{{else}}&mdash;{{/if}}</div>
      </div>
      <div class="bold-meta-pill accent">
        <div class="lbl">Status</div>
        <div class="val">{{invoice.status}}</div>
      </div>
    </div>

    <div class="bold-parties">
      <div class="bold-party">
        <div class="role">From</div>
        <div class="name">{{business.name}}</div>
        {{#if business.addressLine1}}<div class="detail">{{business.addressLine1}}</div>{{/if}}
        {{#if business.city}}<div class="detail">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}</div>{{/if}}
        {{#if business.email}}<div class="detail">{{business.email}}</div>{{/if}}
      </div>
      <div class="bold-party">
        <div class="role">Bill To</div>
        <div class="name">{{party.name}}</div>
        {{#if party.billingAddress1}}<div class="detail">{{party.billingAddress1}}</div>{{/if}}
        {{#if party.billingCity}}<div class="detail">{{party.billingCity}}{{#if party.billingState}}, {{party.billingState}}{{/if}}</div>{{/if}}
        {{#if party.email}}<div class="detail">{{party.email}}</div>{{/if}}
        {{#if party.trn}}<div class="trn">TRN: {{party.trn}}</div>{{/if}}
      </div>
    </div>

    <table class="bold-table">
      <thead>
        <tr>
          <th style="width: 35px;">#</th>
          <th>Description</th>
          <th class="text-center" style="width: 60px;">Qty</th>
          <th class="text-right" style="width: 90px;">Price</th>
          <th class="text-center" style="width: 50px;">Disc%</th>
          <th class="text-center" style="width: 50px;">VAT%</th>
          <th class="text-right" style="width: 95px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{#each lines}}
        <tr>
          <td class="text-center">{{add @index 1}}</td>
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

    <div class="bold-totals-section">
      <div class="bold-totals-box">
        <table>
          <tr><td class="lbl-light">Subtotal</td><td>{{formatMoney invoice.subtotal}}</td></tr>
          {{#if invoice.totalDiscount}}<tr><td class="lbl-light">Discount</td><td>- {{formatMoney invoice.totalDiscount}}</td></tr>{{/if}}
          <tr><td class="lbl-light">VAT</td><td>{{formatMoney invoice.totalTax}}</td></tr>
          <tr class="grand-row"><td>Total {{invoice.currency}}</td><td>{{formatMoney invoice.total}}</td></tr>
          {{#if invoice.amountPaid}}<tr><td class="lbl-light">Paid</td><td>- {{formatMoney invoice.amountPaid}}</td></tr>{{/if}}
          {{#if invoice.balanceDue}}<tr><td class="lbl-light">Balance Due</td><td>{{formatMoney invoice.balanceDue}}</td></tr>{{/if}}
        </table>
      </div>
    </div>

    {{#if invoice.notes}}
    <div class="bold-notes">
      <h4>Notes</h4>
      <p>{{invoice.notes}}</p>
    </div>
    {{/if}}
    {{#if invoice.terms}}
    <div class="bold-notes">
      <h4>Terms &amp; Conditions</h4>
      <p>{{invoice.terms}}</p>
    </div>
    {{/if}}
  </div>

  <div class="bold-footer">
    Thank you for your business! &bull; This is a computer-generated document from <strong>{{business.name}}</strong>
  </div>
</div>
`

// ----------------------------------------------------------------
// 6. PROFESSIONAL QUOTATION — validity banner + acceptance signatures
// ----------------------------------------------------------------
export const PRO_QUOTATION_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 15mm; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.5; }
.qt-container { max-width: 800px; margin: 0 auto; padding: 26px; }
.qt-top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 3px solid #0d9488; margin-bottom: 20px; }
.qt-business h1 { font-size: 22px; color: #0d9488; font-weight: 700; margin-bottom: 6px; }
.qt-business p { font-size: 11px; color: #555; margin-bottom: 2px; }
.qt-business .trn { font-size: 11px; font-weight: 600; color: #1f2937; margin-top: 5px; }
.qt-doc { text-align: right; }
.qt-doc h2 { font-size: 32px; color: #0d9488; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; line-height: 1; }
.qt-doc .num { font-size: 14px; color: #1f2937; font-weight: 600; margin-top: 6px; }
.qt-doc .date { font-size: 11px; color: #555; margin-top: 4px; }
.qt-validity-banner { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; background: #ccfbf1; border: 1.5px solid #0d9488; border-radius: 6px; margin-bottom: 20px; }
.qt-validity-banner .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #0f766e; font-weight: 700; }
.qt-validity-banner .val { font-size: 13px; color: #134e4a; font-weight: 700; margin-left: 6px; }
.qt-validity-banner .left { display: flex; gap: 30px; align-items: center; }
.qt-parties { display: flex; gap: 30px; margin-bottom: 20px; }
.qt-party { flex: 1; }
.qt-party .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 5px; font-weight: 600; }
.qt-party .name { font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
.qt-party .detail { font-size: 11px; color: #555; line-height: 1.5; }
.qt-party .trn { font-size: 11px; font-weight: 600; margin-top: 4px; color: #1f2937; }
.qt-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.qt-table th { background: #0d9488; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
.qt-table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
.qt-table tr:nth-child(even) td { background: #f0fdfa; }
.qt-table .text-right { text-align: right; }
.qt-table .text-center { text-align: center; }
.qt-table .item-desc { font-weight: 600; }
.qt-totals { display: flex; justify-content: flex-end; margin-bottom: 26px; }
.qt-totals table { width: 300px; border-collapse: collapse; }
.qt-totals td { padding: 6px 0; font-size: 11px; }
.qt-totals td:last-child { text-align: right; font-weight: 600; }
.qt-totals .grand-total td { border-top: 2px solid #0d9488; padding-top: 12px; margin-top: 4px; font-size: 14px; font-weight: 800; color: #0d9488; }
.qt-notes { margin-bottom: 22px; padding: 12px 14px; background: #f9fafb; border-radius: 6px; font-size: 11px; color: #555; }
.qt-notes h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #0d9488; margin-bottom: 5px; font-weight: 700; }
.qt-acceptance { margin-top: 28px; padding: 20px; border: 2px solid #0d9488; border-radius: 8px; }
.qt-acceptance h3 { font-size: 13px; color: #0d9488; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.qt-acceptance p { font-size: 10.5px; color: #555; margin-bottom: 20px; line-height: 1.6; }
.qt-signatures { display: flex; gap: 40px; margin-top: 28px; }
.qt-sig-block { flex: 1; }
.qt-sig-block .role-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #0f766e; font-weight: 700; margin-bottom: 32px; }
.qt-sig-block .line { border-top: 1.5px solid #1f2937; padding-top: 5px; font-size: 10px; color: #555; line-height: 1.6; }
.qt-sig-block .name { font-weight: 600; color: #1f2937; }
.qt-footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #888; }
`

export const PRO_QUOTATION_TEMPLATE = `
<div class="qt-container">
  <div class="qt-top">
    <div class="qt-business">
      <h1>{{business.name}}</h1>
      {{#if business.legalName}}<p>{{business.legalName}}</p>{{/if}}
      {{#if business.addressLine1}}<p>{{business.addressLine1}}</p>{{/if}}
      {{#if business.city}}<p>{{business.city}}{{#if business.state}}, {{business.state}}{{/if}} {{business.country}}</p>{{/if}}
      {{#if business.phone}}<p>Tel: {{business.phone}}</p>{{/if}}
      {{#if business.email}}<p>{{business.email}}</p>{{/if}}
      {{#if business.trn}}<p class="trn">TRN: {{business.trn}}</p>{{/if}}
    </div>
    <div class="qt-doc">
      <h2>Quotation</h2>
      <div class="num">{{quotation.number}}</div>
      <div class="date">Date: {{formatDate quotation.date}}</div>
      {{#if quotation.reference}}<div class="date">Ref: {{quotation.reference}}</div>{{/if}}
    </div>
  </div>

  <div class="qt-validity-banner">
    <div class="left">
      <div><span class="lbl">Valid Until:</span><span class="val">{{#if quotation.validUntil}}{{formatDate quotation.validUntil}}{{else}}30 days from issue{{/if}}</span></div>
      <div><span class="lbl">Currency:</span><span class="val">{{quotation.currency}}</span></div>
    </div>
    <div><span class="lbl">Status:</span><span class="val">{{quotation.status}}</span></div>
  </div>

  <div class="qt-parties">
    <div class="qt-party">
      <div class="lbl">Quotation From</div>
      <div class="name">{{business.name}}</div>
      {{#if business.addressLine1}}<div class="detail">{{business.addressLine1}}</div>{{/if}}
      {{#if business.city}}<div class="detail">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}</div>{{/if}}
      {{#if business.email}}<div class="detail">{{business.email}}</div>{{/if}}
      {{#if business.phone}}<div class="detail">{{business.phone}}</div>{{/if}}
    </div>
    <div class="qt-party">
      <div class="lbl">Quotation To</div>
      <div class="name">{{party.name}}</div>
      {{#if party.billingAddress1}}<div class="detail">{{party.billingAddress1}}</div>{{/if}}
      {{#if party.billingCity}}<div class="detail">{{party.billingCity}}{{#if party.billingState}}, {{party.billingState}}{{/if}}</div>{{/if}}
      {{#if party.email}}<div class="detail">{{party.email}}</div>{{/if}}
      {{#if party.phone}}<div class="detail">{{party.phone}}</div>{{/if}}
      {{#if party.trn}}<div class="trn">TRN: {{party.trn}}</div>{{/if}}
    </div>
  </div>

  <table class="qt-table">
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>Description</th>
        <th class="text-center" style="width: 65px;">Qty</th>
        <th class="text-right" style="width: 95px;">Unit Price</th>
        <th class="text-center" style="width: 55px;">Disc%</th>
        <th class="text-right" style="width: 100px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="text-center">{{add @index 1}}</td>
        <td class="item-desc">{{this.description}}</td>
        <td class="text-center">{{this.quantity}}</td>
        <td class="text-right">{{formatMoney this.unitPrice}}</td>
        <td class="text-center">{{this.discount}}</td>
        <td class="text-right">{{formatMoney this.total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="qt-totals">
    <table>
      <tr><td>Subtotal</td><td>{{formatMoney quotation.subtotal}}</td></tr>
      {{#if quotation.totalDiscount}}<tr><td>Discount</td><td>- {{formatMoney quotation.totalDiscount}}</td></tr>{{/if}}
      <tr><td>VAT</td><td>{{formatMoney quotation.totalTax}}</td></tr>
      <tr class="grand-total"><td>Total {{quotation.currency}}</td><td>{{formatMoney quotation.total}}</td></tr>
    </table>
  </div>

  {{#if quotation.notes}}
  <div class="qt-notes">
    <h4>Notes</h4>
    <p>{{quotation.notes}}</p>
  </div>
  {{/if}}
  {{#if quotation.terms}}
  <div class="qt-notes">
    <h4>Terms &amp; Conditions</h4>
    <p>{{quotation.terms}}</p>
  </div>
  {{/if}}

  <div class="qt-acceptance">
    <h3>Acceptance of Quotation</h3>
    <p>To accept this quotation, please sign below and return a copy to us. This quotation is valid until the date specified above. Prices are subject to change after the validity period.</p>
    <div class="qt-signatures">
      <div class="qt-sig-block">
        <div class="role-lbl">Customer Acceptance</div>
        <div class="line">
          <div class="name">Signature</div>
          <div>Name: ____________________________</div>
          <div>Date: ____________________________</div>
        </div>
      </div>
      <div class="qt-sig-block">
        <div class="role-lbl">For {{business.name}}</div>
        <div class="line">
          <div class="name">Authorized Signatory</div>
          <div>Title: ____________________________</div>
          <div>Date: ____________________________</div>
        </div>
      </div>
    </div>
  </div>

  <div class="qt-footer">
    Thank you for considering {{business.name}}. We look forward to working with you.
  </div>
</div>
`

// ----------------------------------------------------------------
// 7. PROFESSIONAL CREDIT NOTE — reason banner + original-invoice ref
// ----------------------------------------------------------------
export const PRO_CREDIT_NOTE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 15mm; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.5; }
.cn-container { max-width: 800px; margin: 0 auto; padding: 26px; }
.cn-top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 3px solid #d97706; margin-bottom: 20px; }
.cn-business h1 { font-size: 22px; color: #d97706; font-weight: 700; margin-bottom: 6px; }
.cn-business p { font-size: 11px; color: #555; margin-bottom: 2px; }
.cn-business .trn { font-size: 11px; font-weight: 600; color: #1f2937; margin-top: 5px; }
.cn-doc { text-align: right; }
.cn-doc h2 { font-size: 32px; color: #d97706; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; line-height: 1; }
.cn-doc .num { font-size: 14px; color: #1f2937; font-weight: 600; margin-top: 6px; }
.cn-doc .date { font-size: 11px; color: #555; margin-top: 4px; }
.cn-reason-banner { padding: 12px 16px; background: #fef3c7; border: 1.5px solid #d97706; border-radius: 6px; margin-bottom: 20px; }
.cn-reason-banner .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #92400e; font-weight: 700; margin-bottom: 4px; }
.cn-reason-banner .val { font-size: 12px; color: #78350f; font-weight: 600; }
.cn-meta { display: flex; gap: 20px; margin-bottom: 20px; padding: 10px 14px; background: #fafafa; border-radius: 6px; border-left: 3px solid #d97706; flex-wrap: wrap; }
.cn-meta-item { min-width: 130px; }
.cn-meta-item .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 600; }
.cn-meta-item .val { font-size: 12px; font-weight: 600; color: #1f2937; margin-top: 3px; }
.cn-parties { display: flex; gap: 30px; margin-bottom: 20px; }
.cn-party { flex: 1; }
.cn-party .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 5px; font-weight: 600; }
.cn-party .name { font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
.cn-party .detail { font-size: 11px; color: #555; line-height: 1.5; }
.cn-party .trn { font-size: 11px; font-weight: 600; margin-top: 4px; color: #1f2937; }
.cn-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
.cn-table th { background: #d97706; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
.cn-table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
.cn-table tr:nth-child(even) td { background: #fffbeb; }
.cn-table .text-right { text-align: right; }
.cn-table .text-center { text-align: center; }
.cn-table .item-desc { font-weight: 600; }
.cn-table .negative { color: #b91c1c; font-weight: 700; }
.cn-totals { display: flex; justify-content: flex-end; margin-bottom: 22px; }
.cn-totals table { width: 300px; border-collapse: collapse; }
.cn-totals td { padding: 6px 0; font-size: 11px; }
.cn-totals td:last-child { text-align: right; font-weight: 600; }
.cn-totals .grand-total td { border-top: 2px solid #d97706; padding-top: 12px; margin-top: 4px; font-size: 14px; font-weight: 800; color: #b91c1c; }
.cn-totals .grand-total td:first-child { color: #d97706; }
.cn-refund-info { padding: 14px 16px; background: #fef3c7; border-left: 4px solid #d97706; border-radius: 4px; margin-bottom: 20px; font-size: 11px; color: #78350f; line-height: 1.6; }
.cn-refund-info strong { color: #92400e; }
.cn-notes { margin-bottom: 20px; padding: 12px 14px; background: #fafafa; border-radius: 6px; font-size: 11px; color: #555; }
.cn-notes h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #d97706; margin-bottom: 5px; font-weight: 700; }
.cn-footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #888; }
`

export const PRO_CREDIT_NOTE_TEMPLATE = `
<div class="cn-container">
  <div class="cn-top">
    <div class="cn-business">
      <h1>{{business.name}}</h1>
      {{#if business.legalName}}<p>{{business.legalName}}</p>{{/if}}
      {{#if business.addressLine1}}<p>{{business.addressLine1}}</p>{{/if}}
      {{#if business.city}}<p>{{business.city}}{{#if business.state}}, {{business.state}}{{/if}} {{business.country}}</p>{{/if}}
      {{#if business.phone}}<p>Tel: {{business.phone}}</p>{{/if}}
      {{#if business.email}}<p>{{business.email}}</p>{{/if}}
      {{#if business.trn}}<p class="trn">TRN: {{business.trn}}</p>{{/if}}
    </div>
    <div class="cn-doc">
      <h2>Credit Note</h2>
      <div class="num">{{creditNote.number}}</div>
      <div class="date">Date: {{formatDate creditNote.date}}</div>
      {{#if creditNote.reference}}<div class="date">Ref: {{creditNote.reference}}</div>{{/if}}
    </div>
  </div>

  <div class="cn-reason-banner">
    <div class="lbl">Reason for Credit Note</div>
    <div class="val">{{#if creditNote.reason}}{{creditNote.reason}}{{else}}&mdash;{{/if}}</div>
  </div>

  <div class="cn-meta">
    <div class="cn-meta-item">
      <div class="lbl">Credit Note No.</div>
      <div class="val">{{creditNote.number}}</div>
    </div>
    <div class="cn-meta-item">
      <div class="lbl">Credit Date</div>
      <div class="val">{{formatDate creditNote.date}}</div>
    </div>
    <div class="cn-meta-item">
      <div class="lbl">Original Invoice Ref</div>
      <div class="val">{{#if creditNote.originalInvoiceNumber}}{{creditNote.originalInvoiceNumber}}{{else}}{{#if creditNote.originalInvoiceId}}{{creditNote.originalInvoiceId}}{{else}}&mdash;{{/if}}{{/if}}</div>
    </div>
    <div class="cn-meta-item">
      <div class="lbl">Currency</div>
      <div class="val">{{creditNote.currency}}</div>
    </div>
    <div class="cn-meta-item">
      <div class="lbl">Status</div>
      <div class="val">{{creditNote.status}}</div>
    </div>
  </div>

  <div class="cn-parties">
    <div class="cn-party">
      <div class="lbl">Issued By</div>
      <div class="name">{{business.name}}</div>
      {{#if business.addressLine1}}<div class="detail">{{business.addressLine1}}</div>{{/if}}
      {{#if business.city}}<div class="detail">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}</div>{{/if}}
      {{#if business.email}}<div class="detail">{{business.email}}</div>{{/if}}
    </div>
    <div class="cn-party">
      <div class="lbl">Credited To</div>
      <div class="name">{{party.name}}</div>
      {{#if party.billingAddress1}}<div class="detail">{{party.billingAddress1}}</div>{{/if}}
      {{#if party.billingCity}}<div class="detail">{{party.billingCity}}{{#if party.billingState}}, {{party.billingState}}{{/if}}</div>{{/if}}
      {{#if party.email}}<div class="detail">{{party.email}}</div>{{/if}}
      {{#if party.trn}}<div class="trn">TRN: {{party.trn}}</div>{{/if}}
    </div>
  </div>

  <table class="cn-table">
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>Description</th>
        <th class="text-center" style="width: 65px;">Qty</th>
        <th class="text-right" style="width: 95px;">Unit Price</th>
        <th class="text-right" style="width: 110px;">Credit Amount</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="text-center">{{add @index 1}}</td>
        <td class="item-desc">{{this.description}}</td>
        <td class="text-center">{{this.quantity}}</td>
        <td class="text-right">{{formatMoney this.unitPrice}}</td>
        <td class="text-right negative">- {{formatMoney this.total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="cn-totals">
    <table>
      <tr><td>Subtotal</td><td>- {{formatMoney creditNote.subtotal}}</td></tr>
      <tr><td>VAT</td><td>- {{formatMoney creditNote.totalTax}}</td></tr>
      <tr class="grand-total"><td>Total Credit {{creditNote.currency}}</td><td>- {{formatMoney creditNote.total}}</td></tr>
    </table>
  </div>

  <div class="cn-refund-info">
    <strong>Refund Information:</strong> The above amount will be credited to your account or refunded according to our mutual agreement. Please contact us if you have any questions regarding this credit note.
  </div>

  {{#if creditNote.notes}}
  <div class="cn-notes">
    <h4>Notes</h4>
    <p>{{creditNote.notes}}</p>
  </div>
  {{/if}}

  <div class="cn-footer">
    This is a computer-generated Credit Note from {{business.name}}. No physical signature required.
  </div>
</div>
`

// ----------------------------------------------------------------
// 8. PROFESSIONAL DELIVERY NOTE — no prices, 3 signature blocks
// ----------------------------------------------------------------
export const PRO_DELIVERY_NOTE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 15mm; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.5; }
.dn-container { max-width: 800px; margin: 0 auto; padding: 26px; }
.dn-top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 3px solid #475569; margin-bottom: 20px; }
.dn-business h1 { font-size: 22px; color: #475569; font-weight: 700; margin-bottom: 6px; }
.dn-business p { font-size: 11px; color: #555; margin-bottom: 2px; }
.dn-business .trn { font-size: 11px; font-weight: 600; color: #1f2937; margin-top: 5px; }
.dn-doc { text-align: right; }
.dn-doc h2 { font-size: 32px; color: #475569; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; line-height: 1; }
.dn-doc .num { font-size: 14px; color: #1f2937; font-weight: 600; margin-top: 6px; }
.dn-doc .date { font-size: 11px; color: #555; margin-top: 4px; }
.dn-meta { display: flex; gap: 20px; margin-bottom: 20px; padding: 10px 14px; background: #f1f5f9; border-radius: 6px; border-left: 3px solid #475569; flex-wrap: wrap; }
.dn-meta-item { min-width: 130px; }
.dn-meta-item .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600; }
.dn-meta-item .val { font-size: 12px; font-weight: 600; color: #1f2937; margin-top: 3px; }
.dn-parties { display: flex; gap: 30px; margin-bottom: 20px; }
.dn-party { flex: 1; }
.dn-party .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 5px; font-weight: 600; }
.dn-party .name { font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
.dn-party .detail { font-size: 11px; color: #555; line-height: 1.5; }
.dn-party .trn { font-size: 11px; font-weight: 600; margin-top: 4px; color: #1f2937; }
.dn-table { width: 100%; border-collapse: collapse; margin-bottom: 26px; }
.dn-table th { background: #475569; color: #fff; padding: 10px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
.dn-table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
.dn-table tr:nth-child(even) td { background: #f8fafc; }
.dn-table .text-center { text-align: center; }
.dn-table .item-desc { font-weight: 600; }
.dn-table .received-col { width: 130px; }
.dn-ack { padding: 14px 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 20px; font-size: 11px; color: #1f2937; line-height: 1.6; }
.dn-ack strong { color: #475569; }
.dn-ack .checkbox { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #475569; margin-right: 6px; vertical-align: middle; position: relative; top: -1px; }
.dn-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; margin-top: 36px; margin-bottom: 22px; }
.dn-sig-block .role-lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 32px; }
.dn-sig-block .line { border-top: 1.5px solid #1f2937; padding-top: 5px; font-size: 10px; color: #555; line-height: 1.6; }
.dn-sig-block .name { font-weight: 600; color: #1f2937; }
.dn-notes { margin-bottom: 20px; padding: 12px 14px; background: #fafafa; border-radius: 6px; font-size: 11px; color: #555; }
.dn-notes h4 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin-bottom: 5px; font-weight: 700; }
.dn-footer { margin-top: 22px; padding-top: 14px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #888; }
`

export const PRO_DELIVERY_NOTE_TEMPLATE = `
<div class="dn-container">
  <div class="dn-top">
    <div class="dn-business">
      <h1>{{business.name}}</h1>
      {{#if business.legalName}}<p>{{business.legalName}}</p>{{/if}}
      {{#if business.addressLine1}}<p>{{business.addressLine1}}</p>{{/if}}
      {{#if business.city}}<p>{{business.city}}{{#if business.state}}, {{business.state}}{{/if}} {{business.country}}</p>{{/if}}
      {{#if business.phone}}<p>Tel: {{business.phone}}</p>{{/if}}
      {{#if business.email}}<p>{{business.email}}</p>{{/if}}
      {{#if business.trn}}<p class="trn">TRN: {{business.trn}}</p>{{/if}}
    </div>
    <div class="dn-doc">
      <h2>Delivery Note</h2>
      <div class="num">{{deliveryNote.number}}</div>
      <div class="date">Date: {{formatDate deliveryNote.date}}</div>
      {{#if deliveryNote.reference}}<div class="date">Ref: {{deliveryNote.reference}}</div>{{/if}}
    </div>
  </div>

  <div class="dn-meta">
    <div class="dn-meta-item">
      <div class="lbl">Delivery Note No.</div>
      <div class="val">{{deliveryNote.number}}</div>
    </div>
    <div class="dn-meta-item">
      <div class="lbl">Delivery Date</div>
      <div class="val">{{formatDate deliveryNote.date}}</div>
    </div>
    <div class="dn-meta-item">
      <div class="lbl">Status</div>
      <div class="val">{{deliveryNote.status}}</div>
    </div>
    {{#if deliveryNote.invoiceNumber}}
    <div class="dn-meta-item">
      <div class="lbl">Related Invoice</div>
      <div class="val">{{deliveryNote.invoiceNumber}}</div>
    </div>
    {{/if}}
  </div>

  <div class="dn-parties">
    <div class="dn-party">
      <div class="lbl">Delivered From</div>
      <div class="name">{{business.name}}</div>
      {{#if business.addressLine1}}<div class="detail">{{business.addressLine1}}</div>{{/if}}
      {{#if business.city}}<div class="detail">{{business.city}}{{#if business.state}}, {{business.state}}{{/if}}</div>{{/if}}
      {{#if business.phone}}<div class="detail">{{business.phone}}</div>{{/if}}
    </div>
    <div class="dn-party">
      <div class="lbl">Deliver To</div>
      <div class="name">{{party.name}}</div>
      {{#if party.shippingAddress1}}<div class="detail">{{party.shippingAddress1}}</div>{{/if}}
      {{#if party.shippingAddress2}}<div class="detail">{{party.shippingAddress2}}</div>{{/if}}
      {{#if party.shippingCity}}<div class="detail">{{party.shippingCity}}{{#if party.shippingState}}, {{party.shippingState}}{{/if}}{{#if party.shippingPostalCode}} {{party.shippingPostalCode}}{{/if}}</div>{{/if}}
      {{#if party.phone}}<div class="detail">{{party.phone}}</div>{{/if}}
      {{#if party.trn}}<div class="trn">TRN: {{party.trn}}</div>{{/if}}
    </div>
  </div>

  <table class="dn-table">
    <thead>
      <tr>
        <th style="width: 35px;">#</th>
        <th>Description</th>
        <th class="text-center" style="width: 100px;">Quantity</th>
        <th class="text-center received-col">Received (Qty)</th>
      </tr>
    </thead>
    <tbody>
      {{#each lines}}
      <tr>
        <td class="text-center">{{add @index 1}}</td>
        <td class="item-desc">{{this.description}}</td>
        <td class="text-center">{{this.quantity}}</td>
        <td class="text-center">__________</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="dn-ack">
    <strong>Acknowledgment:</strong>
    <span class="checkbox"></span>I confirm that the goods listed above have been received in good condition, and that the quantities are correct as marked.
  </div>

  {{#if deliveryNote.notes}}
  <div class="dn-notes">
    <h4>Delivery Notes</h4>
    <p>{{deliveryNote.notes}}</p>
  </div>
  {{/if}}

  <div class="dn-signatures">
    <div class="dn-sig-block">
      <div class="role-lbl">Prepared By</div>
      <div class="line">
        <div class="name">Signature</div>
        <div>Name: ________________</div>
        <div>Date: ________________</div>
      </div>
    </div>
    <div class="dn-sig-block">
      <div class="role-lbl">Delivered By</div>
      <div class="line">
        <div class="name">Signature</div>
        <div>Name: ________________</div>
        <div>Date: ________________</div>
      </div>
    </div>
    <div class="dn-sig-block">
      <div class="role-lbl">Received By</div>
      <div class="line">
        <div class="name">Signature</div>
        <div>Name: ________________</div>
        <div>Date: ________________</div>
      </div>
    </div>
  </div>

  <div class="dn-footer">
    This Delivery Note is issued by {{business.name}}. Goods remain the property of {{business.name}} until full payment is received.
  </div>
</div>
`
