# AccountERP — Complete Implementation Plan (UAE Edition)

> A modern, self-hostable, cloud-ready ERP accounting platform inspired by Manager.io,
> built for UAE VAT compliance (5%) and UAE FTA e-invoicing (PINT AE).
> Runs locally on Windows/Mac/Linux and deploys as SaaS.

---

## 1. Vision

Build a complete double-entry accounting ERP that replaces Manager.io, with:
- **Full accounting core** — chart of accounts, journal entries, customers, suppliers, invoices, bills, payments
- **UAE compliance** — VAT 5%, TRN on every document, VAT return report, PINT AE e-invoicing XML
- **Customizable PDF templates** — visual + code editor for invoices, delivery notes, statements
- **Better custom fields** — organized into tabs & sections (not a flat list like Manager.io)
- **Multi-business** — manage multiple companies in one installation
- **Docker-ready** — one command to run anywhere
- **SaaS-ready** — multi-tenant architecture path documented

## 2. Tech Stack (Adapted to this environment)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | Full-stack, API routes, SSR, file-based routing |
| Language | **TypeScript 5** | Type safety for financial logic |
| Database | **Prisma ORM + SQLite (dev) / PostgreSQL (prod)** | Switchable via `DATABASE_URL` |
| Money math | **decimal.js** | Never use floats for currency/VAT |
| UI | **Tailwind CSS 4 + shadcn/ui (New York)** | Consistent, accessible components |
| State | **Zustand** (client) + **TanStack Query** (server) | Modern, performant |
| Forms | **React Hook Form + Zod** | Shared validation client/server |
| Charts | **Recharts** | Financial dashboards |
| PDF engine | **@react-pdf/renderer** (programmatic) + **HTML template system** | Portable, no Chrome dependency |
| Auth | **NextAuth.js v4** (ready) + JWT sessions | |
| Icons | **lucide-react** | |
| Container | **Docker + docker-compose** | Local = production parity |

## 3. Architecture Principles

1. **Single source of truth for money** — every financial mutation flows through a `postTransaction()` service using decimal.js
2. **Single VAT engine** — `calculateVAT()` service, never hardcode 5%
3. **Double-entry enforced** — journal entries must balance (debits = credits) server-side
4. **Posted = immutable** — corrections via credit notes / reversal entries
5. **Tenant/business scoping** — every query filtered by `businessId`
6. **Audit trail** — every financial record logs who/when/what
7. **Template-driven PDFs** — templates stored in DB, rendered with data context
8. **Custom fields as data, not schema** — JSON-based field definitions + values

## 4. Module Map

### Core Accounting
- **Dashboard** — KPIs, cash flow chart, receivables/payables, recent transactions
- **Chart of Accounts** — hierarchical, account types, control accounts, UAE template
- **Journal Entries** — manual double-entry, validation, posting
- **General Ledger** — view postings per account
- **Trial Balance** — debits/credits summary

### Parties
- **Customers** — TRN, billing/shipping addresses, payment terms, credit limit
- **Suppliers** — TRN, addresses, payment terms

### Sales Cycle
- **Quotations** — estimates, convert to invoice
- **Sales Invoices** — line items, VAT, sequential numbering, post to GL
- **Credit Notes** — linked to original invoice, reverses entries
- **Delivery Notes** — goods delivery tracking
- **Receipts** — customer payments with invoice allocation

### Purchase Cycle
- **Purchase Orders**
- **Purchase Bills** — input VAT tracking
- **Payments** — supplier payments with bill allocation

### Banking
- **Bank Accounts** — cash & bank, opening balances
- **Bank Transactions** — deposits/withdrawals
- **Reconciliation** — match statements (CSV import)

### Inventory
- **Items** — SKU, stock, cost (FIFO/weighted avg), sale price
- **Stock Movements** — linked to invoices/bills
- **Warehouses** (basic)

### Reports
- **Profit & Loss** — period, comparative
- **Balance Sheet** — as-of date
- **Cash Flow Statement**
- **Trial Balance**
- **Aged Receivables / Payables**
- **UAE VAT Return** — output VAT, input VAT, net payable
- **General Ledger** — per account
- **Customer / Supplier Statements**

### Compliance (UAE)
- **VAT Returns** — 5% standard, zero-rated, exempt categories
- **PINT AE XML** — generate UBL 2.1 XML per invoice (stored, ASP-ready)
- **TRN validation** — on every party & business

### System
- **Custom Fields** — per doctype, tabs/sections, multiple types
- **PDF Templates** — editable HTML/CSS templates with live preview
- **Settings** — business profile, tax rates, currencies, users, numbering schemes
- **Audit Log** — every financial mutation

## 5. Database Schema (Prisma) — Key Models

```
Tenant ─┬─ Business ─┬─ Account (Chart of Accounts)
        │            ├─ Customer / Supplier (Party)
        │            ├─ JournalEntry ─ JournalLine
        │            ├─ SalesInvoice ─ InvoiceLine
        │            ├─ PurchaseBill ─ BillLine
        │            ├─ Payment ─ PaymentAllocation
        │            ├─ Quotation, CreditNote, DeliveryNote
        │            ├─ Item (Inventory)
        │            ├─ BankAccount ─ BankTransaction
        │            ├─ TaxRate
        │            ├─ Currency ─ ExchangeRate
        │            ├─ CustomFieldDefinition ─ CustomFieldValue
        │            ├─ PdfTemplate
        │            └─ AuditLog
        └─ User (membership) ─ Role ─ Permission
```

**Money storage:** all monetary values stored as `Decimal` (Prisma) → `DECIMAL(18,4)` in DB.
**Never** use Float.

## 6. PDF Template System

- Templates are **HTML + CSS + Handlebars-like placeholders** stored in DB
- Each doctype (invoice, bill, statement, delivery note) has default templates
- Users can **clone, edit, set as default** per business
- **Live preview** renders with sample data
- Placeholders: `{{business.name}}`, `{{invoice.number}}`, `{{invoice.lines}}`, `{{invoice.total}}`, etc.
- Rendering: HTML → PDF via `@react-pdf/renderer` (portable, no Chrome) OR server-side HTML-to-PDF
- Bilingual support (English/Arabic RTL) built into template CSS

## 7. Custom Fields System (Better than Manager.io)

- Defined **per doctype** (Invoice, Customer, Bill, Item, etc.)
- Organized into **Tabs → Sections → Fields** (not flat list)
- Field types: text, number, decimal, date, select, checkbox, textarea, link (to another record)
- Each field: label (en/ar), required, default, options, validation
- Stored as JSON values keyed by field ID on each record
- Rendered dynamically in forms based on definitions
- **Future:** formula fields, conditional visibility, child tables

## 8. UAE Compliance

### VAT (5%)
- Tax categories: Standard-rated (5%), Zero-rated (0%), Exempt, Out-of-scope
- Every invoice/bill shows TRN + VAT breakdown
- VAT return report: Output VAT (sales), Input VAT (purchases), Net payable/refund

### E-Invoicing (PINT AE)
- Generate UBL 2.1 XML per invoice (Phase 2: stored locally)
- ASP submission interface stubbed (`submitToASP()`) for future integration
- Unique UUID per invoice, line-level VAT breakdown, TIN identifiers
- Mandatory timeline: 2026 voluntary → 2027 mandatory

## 9. Phased Delivery

### Phase 1 — Foundation (NOW)
- Database schema (all models)
- App shell: sidebar, topbar, theme, business switcher
- Dashboard with KPIs
- Chart of Accounts (CRUD + UAE template seed)
- Business settings

### Phase 2 — Core Accounting
- Journal entries (double-entry)
- Customers & Suppliers
- Sales invoices + VAT
- Purchase bills + VAT
- Payments (receipts & payments)
- Trial balance, P&L, Balance Sheet reports

### Phase 3 — Depth
- Quotations, credit notes, delivery notes
- Inventory/items
- Banking & reconciliation
- Custom fields system
- PDF template system with editor
- VAT return report
- Aged receivables/payables

### Phase 4 — Compliance & SaaS
- PINT AE XML generation
- Multi-tenant hardening
- Docker packaging
- Deployment docs
- User management & roles

## 10. Docker & Deployment

- `Dockerfile` — multi-stage build, runs Next.js standalone
- `docker-compose.yml` — app + (optional) PostgreSQL
- `.env.example` — all config documented
- Same image runs locally (Windows/Mac/Linux via Docker Desktop) and in cloud
- SaaS deploy: any VPS with Docker, or Vercel/Railway/Render

## 11. Distribution

- Full source code as ZIP (downloadable)
- `README.md` with setup instructions for local dev + Docker
- `docker-compose up` = running app
- Database auto-seeds UAE chart of accounts + demo business on first run
