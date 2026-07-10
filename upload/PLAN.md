# PLAN.md — AccountERP Full Implementation Plan (UAE Edition, Docker-First)

## 1. Vision
A self-hosted accounting ERP functionally equivalent to manager.io, built for the UAE market:
full double-entry accounting, quotations, sales, purchases, banking, inventory, reporting,
UAE VAT compliance, and e-invoicing (Peppol PINT AE) built as local-first, ASP-ready logic —
plus a future SaaS multi-tenant layer. Runs fully containerized via Docker from day one.

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Fast HMR, small bundles |
| Styling | Tailwind CSS + shadcn/ui | Per THEME.md — Coffee Ledger theme |
| Data fetching | TanStack Query (React Query) | Optimistic updates, no full reloads |
| Forms | React Hook Form + Zod | Shared validation schemas with backend |
| Routing | React Router v6 | Nested routes per module |
| Backend | Node.js + Express (TypeScript) | Runs inside Docker container |
| Database | MySQL 8 | Runs inside Docker container, DECIMAL columns for all money fields |
| Money math | decimal.js | Never use native floating point for currency/VAT math |
| ORM | Prisma | Type-safe schema, migrations |
| Auth | JWT (access+refresh) + bcrypt | Roles/permissions from Phase 0 |
| PDF engine | Puppeteer (headless Chrome) | Runs fine inside Docker — container provides the
  system dependencies Puppeteer needs, which is exactly why we containerize now |
| Email (outbound) | Nodemailer + editable HTML templates | Built into Phase 2, auto-attach PDF |
| E-invoicing | XML generation (UBL/PINT AE structure) | Local-only for now — ASP/Peppol network
  submission is a stubbed interface, filled in later when hosting/ASP is chosen |
| Testing | Vitest + Supertest + Playwright | See TESTING_STRATEGY.md |
| CI | GitHub Actions | Independently re-runs tests on every push — see ci.yml |
| Containerization | Docker + docker-compose | app, mysql, (nginx later) services |
| Monorepo | pnpm workspaces (frontend/backend/shared) | Runs inside the app container |
| Version control | Git, GitHub Flow | See GIT_WORKFLOW.md |
| Hosting (decision deferred) | TBD — evaluate cheap VPS options (Hetzner, Contabo,
  Hostinger VPS, DigitalOcean) once local build is stable. Any VPS with root SSH works
  identically since the whole app is already Dockerized. | See Section 7 |

## 3. Why Docker From Day One
- Puppeteer requires system-level Chromium dependencies that shared/managed hosting can't
  provide (no root access). Docker solves this once, consistently, everywhere.
- Local dev environment becomes identical to production — no "works on my machine" drift.
- The planned future SaaS/multi-tenant phase already assumes containers; building this way now
  avoids a re-platforming event later.
- Hosting choice becomes decoupled from architecture — any VPS with Docker installed works,
  so we can shop for the cheapest suitable VPS later without redesigning anything.


- Every accounting transaction posts through a single `postTransaction()` service.
- Every taxable transaction computes VAT through a single `calculateVAT()` service using
  decimal.js — never hardcode 5% inline, never use native floats.
- Invoice numbering uses a row-locked counter inside the same DB transaction as the invoice
  insert (SELECT ... FOR UPDATE pattern) to guarantee sequential, gapless numbers under
  concurrent requests.
- E-invoicing generation is a dedicated `einvoice` service module, decoupled from invoice UI,
  producing valid PINT AE XML locally; actual ASP transmission is a stubbed interface
  (`submitToASP()`) implemented later.
- All tenant-scoped queries (Phase 8+) go through a single Prisma middleware that
  auto-injects the tenant_id filter — no hand-rolled query can leak data across tenants.

## 5. Module Phases

### Phase 0: Foundation
- Docker + docker-compose setup (app container + MySQL container), .env template
- pnpm monorepo scaffold, ESLint+Prettier, Husky pre-commit
- GitHub Actions CI workflow (ci.yml) — runs lint, typecheck, tests on every push
- Prisma init + MySQL (in container), base schema (User, Role, Permission)
- Auth: register/login, JWT, roles (Admin, Accountant, Viewer)
- Base layout: sidebar, topbar, light/dark toggle per THEME.md
- Company settings schema: TRN, legal name, address, Emirate, default currency (AED)

### Phase 1: Core Ledger
- Chart of accounts: CRUD, account types, custom control accounts
- Journal entries: manual entry, double-entry validation (debits = credits), decimal.js math
- General ledger, trial balance
- Multi-currency: currency table, exchange rates, base currency = AED default

### Phase 2: Sales Cycle + UAE VAT + E-Invoicing + Email
- Customers: CRUD, TRN field, billing address (Emirate-aware)
- Quotations/estimates → convert to invoice
- Invoices: line items, VAT calculation (Standard 5%, Zero-rated, Exempt, Out-of-scope),
  row-locked sequential numbering, auto journal entry on posting
- TaxRate module: UAE VAT categories via calculateVAT() service
- E-invoicing module: generate PINT AE-compliant UBL XML per invoice (local validation only;
  submitToASP() stub for future ASP integration)
- PDF template engine: Puppeteer + Handlebars templates (runs in Docker), live preview,
  editable via UI, includes TRN, VAT breakdown, sequential invoice number
- Email sending: Nodemailer, editable email templates, auto-attach generated invoice PDF
- Credit notes: linked to original invoice, reverses journal entries + VAT correctly
- Accounts receivable ledger, customer statements (PDF export)

### Phase 3: Purchases Cycle
- Suppliers: CRUD, TRN field
- Purchase orders, bills with input VAT tracking
- Accounts payable ledger, aged payables
- Remittance advices (PDF)

### Phase 4: Banking & Reconciliation
- Cash/bank accounts, manual transaction entry
- Bank statement import (CSV/OFX)
- Reconciliation UI
- Recurring billing

### Phase 5: Inventory & Projects
- Inventory items: SKU, stock levels, FIFO/weighted average costing
- Stock movements linked to sales/purchases
- Projects: cost tracking, billable expenses, time billing
- Fixed assets: register, depreciation

### Phase 6: Reporting + VAT Return
- Profit & Loss, Balance Sheet, Statement of Changes in Equity
- Comparative reports, drill-down
- UAE VAT Return report (output VAT, input VAT, net payable/refundable)
- Audit file export for FTA compliance

### Phase 7: Payroll & Manufacturing (optional, defer)

### Phase 8: SaaS Layer
- Activate roles/permissions fully
- Multi-business/tenant model, tenant_id middleware enforced on all queries
- Subscription/billing for end customers
- Choose production hosting (Section 7) — Docker setup already portable to any VPS

### Phase 9: Email Inbox / Compose (deferred)
- Full inbox/compose panel, using Gmail API / Microsoft Graph OAuth rather than hand-built
  IMAP sync — far less maintenance long-term

## 6. UAE Compliance Requirements (Reference — verify with a UAE tax advisor before go-live)
- VAT: Standard rate 5%; categories: Standard-rated, Zero-rated, Exempt, Out-of-scope. Every
  invoice/bill must show TRN and VAT breakdown per FTA invoice content rules.
- E-Invoicing: Businesses with revenue >= AED 50 million must appoint an Accredited Service
  Provider (ASP) by 30 October 2026 (extended from 31 July 2026 by MoF amendment, May 2026);
  mandatory go-live remains 1 January 2027. Smaller businesses: ASP by 31 March 2027, go-live
  1 July 2027. Invoices must be structured XML in PINT AE format (UAE Data Dictionary on
  Peppol International/PINT + UBL), exchanged via a decentralized five-corner Peppol model.
- Data residency: e-invoice data generally expected to be stored within the UAE, with typical
  retention of 5+ years for VAT and 7+ years where Corporate Tax applies — confirm exact rules
  with a UAE tax advisor before choosing a final hosting region.
- For local development now: build and validate PINT AE XML generation only. ASP registration
  and live transmission are deferred until hosting/production launch.

## 7. Hosting (Decision Deferred)
No hosting provider is locked in yet. Because the entire app is Dockerized, any VPS with
Docker support works without architecture changes. When ready, compare cheap VPS options
(e.g. Hetzner, Contabo, DigitalOcean, Hostinger VPS tiers) purely on price/specs — the app
itself does not need to change. Revisit UAE data residency requirements (Section 6) when
narrowing down the final hosting region.

## 8. Non-Goals (for now)
- No mobile app (responsive web only)
- No multi-language i18n until Phase 8 (flag in MEMORY.md if Arabic labels are needed sooner)
- No live bank feed integrations until explicitly requested
- No ASP/Peppol live transmission until hosting is finalized


