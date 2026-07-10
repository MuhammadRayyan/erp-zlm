# Accounting SaaS — Requirements & Specification

**Status:** Draft v1
**Owner:** Solo founder, AI-assisted development
**Markets:** United Arab Emirates (primary) → GCC → eventually global

---

## 1. Overview

A multi-tenant cloud accounting platform, positioned as a modern replacement for Manager.io. Targets small and medium businesses and accounting firms in the UAE. Distinguishing characteristics:

- Modern, well-designed UI and PDF output (the primary visual complaint against Manager.io)
- Multi-tenant SaaS with per-customer subdomains and optional custom domains
- Multiple businesses per customer, with subscription-based caps
- UAE FTA e-invoicing compliance (mandatory rollout 2026–2027)
- Multi-currency, bilingual (English / Arabic with RTL)
- Self-hostable via Docker as a secondary distribution mode

---

## 2. Functional Requirements

### 2.1 Multi-tenancy

- Multiple isolated tenants (customers) on a single platform
- Tenant access via subdomain (`acme.appname.com`)
- Optional custom domain per tenant (later phase)
- Tenant data must be isolated from other tenants at the database level, not only the application level
- A single user account may belong to multiple tenants (supports accountants managing multiple clients)

### 2.2 Multi-business per tenant

- Each tenant can manage one or more businesses (companies)
- Number of businesses is constrained by the tenant's subscription plan
- Each business has its own chart of accounts, transactions, fiscal year, base currency, tax registration, and reports
- Cross-business consolidation is a future feature

### 2.3 Users and roles

- Each tenant can have multiple users
- Number of users is constrained by the tenant's subscription plan
- Role-based permissions, including at minimum: Owner, Admin, Accountant, Viewer
- Role system should be flexible enough to add new roles or refine permissions over time
- Users authenticate once and select which tenant to access

### 2.4 Accounting core

- Hierarchical chart of accounts (per business), with seeded UAE-standard templates
- Double-entry journal entries with server-enforced validation
- Customers and suppliers (parties), with TRN, addresses, payment terms, default currency
- Sales invoices and purchase bills
- Payments, with one-to-many application against invoices and bills
- Manual bank reconciliation via CSV/OFX import
- Period locking — once a period is closed, transactions in it cannot be modified
- Posted transactions are immutable; corrections are made via reversal or credit note
- Full audit trail on every financial mutation (who, when, what changed)

### 2.5 Reporting

- Trial balance
- Profit & Loss
- Balance sheet
- Cash flow statement
- Aged receivables and payables
- UAE VAT return (5%)
- All reports exportable to PDF
- Reports filterable by company, date range, and other relevant dimensions

### 2.6 Multi-currency

- Per-business base currency
- Transactions in any currency, with FX rate captured at transaction time
- FX gains and losses recognized in reports
- Monetary values must use fixed-point/decimal storage, never floating point
- FX rates must be stored with sufficient precision to avoid rounding errors

### 2.7 Custom fields

- Defined per doctype (Invoice, Customer, Bill, etc.)
- Field types in MVP: text, number, date, single-select, checkbox, long text
- Field types added later: link to another record, formula (calculated), table (child rows), conditional visibility
- Fields organized into tabs and sections in the UI (ERPNext-style), not as a flat list
- Field labels bilingual (English / Arabic)
- The custom-field system must be flexible enough to support future field types without invasive changes

### 2.8 PDF generation

- Modern, professionally designed default templates for invoices, bills, statements, and reports
- HTML/CSS-based template approach for maintainability and design flexibility
- Customer can clone and modify templates in the UI (later phase)
- Bilingual templates (English / Arabic, with RTL support)

### 2.9 UAE e-invoicing compliance

See Section 6 for full specification.

### 2.10 Subscriptions and billing

- Tiered subscription plans
- Each plan must define limits on businesses and users; may define limits on other dimensions (e.g. invoices per month)
- Each plan must define a set of feature flags indicating which capabilities are included (e.g. e-invoicing, API access, bank feeds, recurring invoices)
- Plan structure must be flexible enough to add new limit dimensions or feature flags without major refactoring
- Trial period support
- Monthly and yearly billing cycles
- Stripe integration for payment processing
- Plan upgrade and downgrade, with prorated billing
- Limit enforcement at the application layer before any new business is created or user invited

### 2.11 Authentication and authorization

- Email + password
- Magic link login
- Optional two-factor authentication
- Password reset and email verification
- SSO (later phase)
- Permissions enforced server-side on every action, not only in the UI

### 2.12 Localization

- English (MVP)
- Arabic with full RTL layout (before public launch)
- Bilingual invoice and statement PDFs
- Locale-aware number, date, and currency formatting

### 2.13 Data import and export

- CSV import for chart of accounts, parties, opening balances (MVP)
- Manager.io importer (Phase 3) for prospect migration
- Full tenant data export available on request (regulatory requirement)

---

## 3. Non-Functional Requirements

### 3.1 Performance

- Server response p95 under 50 ms for typical CRUD operations
- Page navigation feels instant — no full page reloads between common screens
- Optimistic UI updates for safe actions
- Database indexes on common filter columns (date, company, party, status)

### 3.2 Security

- Tenant data isolated at the database level
- Defense-in-depth: a single missing application-level check should not be sufficient to expose cross-tenant data
- HTTPS everywhere; wildcard TLS for subdomains; per-domain TLS for custom domains
- Secrets stored in environment variables, never in code
- All financial mutations audit-logged
- Posted financial records are immutable

### 3.3 Reliability

- Daily database backups, retained 30 days minimum
- Off-site backup storage
- Error tracking on production with alerting
- Health-check endpoints
- Graceful degradation when background services are slow or unavailable

### 3.4 Compliance

- UAE 10-year retention for invoices and tax records
- UAE FTA e-invoicing mandate (Ministerial Decisions 243 and 244 of 2025)
- UAE VAT compliance
- Data residency: portable architecture so the system can be redeployed to UAE-resident infrastructure when required

### 3.5 Maintainability

- Single primary language across the application
- Single container artifact runs locally and in production
- Version-controlled, reversible database migrations
- Comprehensive automated test suite (see Section 9)
- Stable, conservative framework choices for a long maintenance lifespan

### 3.6 Scalability

- Vertical scaling on a single VPS sufficient for the first 50–200 active tenants
- Horizontal scaling path: separate web, worker, database, and cache onto dedicated nodes without code changes
- Application logic should remain tenant-aware only at a thin middleware layer; everything else stays unaware

---

---

## 5. Architecture

### 5.1 Tenant isolation

The platform uses a schema-per-tenant model in PostgreSQL. Each tenant has its own database schema; the platform runs on a single database with a single connection pool. A subdomain-based middleware resolves the tenant from the request hostname and scopes all subsequent database access to that tenant's schema. Application code outside the middleware should be unaware of tenancy.

### 5.2 Shared vs per-tenant data

Some data is shared across all tenants (in a public schema): tenant registry, user accounts, tenant memberships, plans, and subscriptions.

All business and accounting data lives inside the tenant's own schema: companies, chart of accounts, journal entries, parties (customers and suppliers), invoices, bills, payments, custom field definitions and values, audit log entries.

### 5.3 Multi-business model

Within a tenant's schema, every transactional record is associated with a specific business (company). All reports and queries are scoped by business by default. Per-business permissions may be added in a future phase; in MVP, tenant-level access grants visibility to all businesses in that tenant.

### 5.4 Subscription and plan model

The platform must support a tiered subscription model where each plan defines:

- Pricing for monthly and annual billing cycles
- Maximum number of businesses (companies) the tenant can create
- Maximum number of users the tenant can invite
- Optional additional limits (e.g. invoices per month)
- A set of feature flags indicating which capabilities are included

Each tenant has one active subscription that tracks plan, status (trialing, active, past due, canceled, paused), billing cycle, current period dates, and trial expiration.

The plan structure must be flexible enough to add new limit dimensions or feature flags later without invasive schema changes. Plans should map to billing provider products so subscription state stays synchronized with the payment processor via webhooks.

Limit enforcement happens at the application layer before any new business is created or user invited. Errors must be clear and actionable for the user (e.g. "Your plan allows 1 business; upgrade to add more").

### 5.5 Custom fields

The platform must support customer-defined custom fields on key doctypes. Requirements:

- Multiple field types (see Section 2.7)
- Fields organized into tabs and sections in the UI, not a flat list
- Bilingual labels (English / Arabic)
- Required-field validation enforced server-side
- Type-specific configuration (e.g. select choices, link target, validation rules) stored flexibly so new field types can be added without schema migrations
- Field values scoped to the specific record they are attached to

The data model implementing custom fields must be flexible enough to support future field types and configuration options.

### 5.6 PDF generation

PDFs are generated from HTML/CSS templates. The system must support per-tenant template overrides in later phases. PDF generation runs synchronously for single documents and asynchronously (via background jobs) for batches.

### 5.7 Background jobs

The platform requires a reliable, resumable background-job system for: PDF batch generation, e-invoice XML generation and submission, recurring invoice generation, scheduled reports, email sending, bank statement imports, and scheduled backups. Failed jobs must be retriable and visible to operators.

### 5.8 Hosting and deployment

The platform must be deployable as a containerized stack. The same container image must run in local development and in production. The architecture must be portable across hosting providers — moving to a different provider (for data residency or cost reasons) should not require application code changes. Local development must run on Docker Desktop on a developer's machine.

---

## 6. UAE E-Invoicing Specification

### 6.1 Regulatory timeline

| Phase | Date | Scope |
|---|---|---|
| Voluntary / pilot | July 1, 2026 | Selected taxpayers |
| Mandatory | January 1, 2027 | Businesses with annual revenue ≥ AED 50M (ASP appointment by Oct 31, 2026) |
| Mandatory | July 1, 2027 | Businesses with annual revenue < AED 50M |
| Mandatory | October 1, 2027 | Government entities |

B2C transactions are excluded from the mandate at this time.

### 6.2 Technical requirements

- **Standard:** PINT AE (PEPPOL profile based on UBL 2.1)
- **Format:** Structured XML — PDFs and paper are not valid for B2B/B2G
- **Transmission:** Via FTA-Accredited Service Provider (ASP); direct FTA submission is not permitted
- **Model:** PEPPOL 5-corner model; tax data reaches FTA via Corner 5 within 14 days
- **Identifier:** TIN — first 10 digits of the corporate tax registration number (TRN)
- **Required data:** Supplier and buyer TINs, line-level VAT breakdowns, UNECE unit codes, ISO 4217 currency codes, unique document UUID per invoice
- **Integrity:** Digital signatures and immutable audit trail
- **Retention:** 10 years inside the UAE
- **Penalties:** Up to AED 5,000 per month for ongoing violations; up to AED 50,000 for certain breaches

### 6.3 Implementation approach

- The platform must never communicate with FTA directly; all transmission must be via an ASP
- The ASP integration must be implemented behind an adapter so the integration partner can be swapped without changes to business logic
- PINT AE XML must be generated and stored for every invoice starting Phase 2, even before ASP submission is enabled
- Posted invoices must be immutable; corrections happen via credit notes that structurally reference the original invoice
- Submission to ASP is implemented in Phase 3

---

## 7. Distribution Modes

### 7.1 Cloud SaaS (primary)

Customers sign up at `appname.com`, receive a subdomain, and are hosted on the platform's infrastructure. This is the main commercial product.

### 7.2 Self-hosted Docker (Phase 3)

The same containerized stack delivered to customers for on-premises or private-cloud installation. Ships with installation documentation and license-key activation. Targets customers with data residency or sovereignty requirements.

### 7.3 Windows installer (deferred)

A single-file Windows installer with bundled runtime, registered as a Windows service. Not committed; built only if customer demand justifies the engineering investment.

---

## 8. Phased Roadmap

### Phase 0 — Foundations

- Project scaffold with the documented tech stack
- Multi-tenancy infrastructure operational (multiple test tenants resolvable by subdomain)
- User authentication, tenant membership, role-based permissions
- Subscription plans and limit enforcement (manually assigned in admin)
- Multi-business support (Company model and basic UI)
- CI pipeline running tests on every push

### Phase 1 — Accounting core

- Chart of accounts (hierarchical, per-business, UAE template seeded)
- Journal entries with double-entry validation
- Parties (customers, suppliers) with TRN and full address support
- Sales invoices with PINT AE-compliant field structure
- Purchase bills
- Payments with multi-document application
- Manual bank reconciliation via CSV/OFX import
- Reports: trial balance, P&L, balance sheet, cash flow, aged receivables/payables, UAE VAT return
- Period locking
- Full audit log
- Modern PDF templates for invoices, bills, statements, and reports

**Milestone:** the founder's own business is migrated off Manager.io and runs live on the platform.

### Phase 2 — SaaS readiness

- First production cloud deployment
- Wildcard TLS for subdomains
- Self-serve signup with tenant provisioning
- Stripe billing integration
- Custom fields with tabs implemented in the UI
- Arabic UI with RTL layout
- Bilingual invoice templates
- PINT AE XML generation and storage (no submission yet)

### Phase 3 — UAE compliance and depth

- ASP integration for e-invoice submission, via swappable adapter
- E-invoicing operations dashboard (submitted, pending, failed states)
- Bank feed integration (Lean Technologies)
- Inventory module
- Recurring invoices
- Custom domain support with per-domain TLS
- Customer-facing audit log UI
- Formula and link custom fields
- Manager.io importer for prospects
- Self-hosted Docker distribution packaged

### Phase 4+ — Expansion

- Fixed assets
- Payroll (UAE WPS integration)
- Projects and job costing
- Table custom fields
- Public REST API for integrations
- Multi-business consolidation reports
- GCC expansion (KSA ZATCA integration first)
- Windows installer (if customer demand justifies it)

---

## 9. Testing Requirements

Automated tests are mandatory, not optional. They protect financial correctness (the most important property of accounting software), enable safe refactoring, and let development resume confidently after long breaks without manual re-verification.

### 9.1 Coverage expectations

- All financial calculation logic must have tests
- All permission checks and role enforcement must have tests
- All multi-tenancy isolation boundaries must have tests
- Critical user flows (signup, invoicing, payment, reporting) must have end-to-end tests
- All integration points (Stripe, ASP, email, bank feeds) must have tests against mocked responses
- Tests must pass in CI before any change is merged

The following sections are **illustrative examples** of tests that must exist. They are not exhaustive — the developer is expected to add comprehensive coverage beyond what is listed here.

### 9.2 Multi-tenancy and isolation

- A user authenticated in tenant A cannot read or write data in tenant B
- Subdomain routing resolves correctly to the matching tenant
- A database query executed without an explicit tenant context fails safely
- Schema migrations applied to one tenant do not affect other tenants
- Tenant deletion removes that tenant's data without affecting any other tenant

### 9.3 Subscriptions and plan limits

- Creating a business when the plan's business limit has been reached is rejected with a clear error
- Inviting a user when the plan's user limit has been reached is rejected
- Plan upgrade increases limits and allows previously-blocked operations
- Plan downgrade is rejected when current usage exceeds the new limit
- Trial subscription expires correctly and transitions to the expected state
- Feature flags correctly gate features (e.g. e-invoicing is unavailable on plans that do not include it)

### 9.4 Authentication and permissions

- Unauthenticated requests to protected pages redirect to login
- A user with Viewer role cannot post journal entries
- A user with Accountant role cannot modify subscription settings
- Magic link tokens expire and become invalid after use
- 2FA enrollment, challenge, and recovery flows work correctly
- A user removed from a tenant immediately loses access to that tenant's data

### 9.5 Accounting correctness

- A journal entry is rejected when debits and credits do not balance
- A posted journal entry cannot be modified
- Transactions cannot be created or edited in a locked period
- Reversal entries correctly negate the original
- Multi-currency transactions calculate base-currency amounts correctly using the captured FX rate
- Trial balance debits and credits sum to equal totals across all fixtures
- VAT calculations match expected amounts at UAE 5% across edge cases (rounding, multiple lines, partially taxable items, zero-rated supplies)

### 9.6 Invoicing and PINT AE compliance

- Invoice number is unique per business per fiscal year
- A posted invoice cannot have lines added, removed, or modified
- A credit note structurally references the original invoice
- Generated PINT AE XML contains all mandatory fields
- Generated PINT AE XML validates against the published schema
- Invoices for non-VAT-registered customers are handled correctly

### 9.7 Reports

- P&L for a known fixture matches expected line totals
- Balance sheet always balances (assets equal liabilities plus equity)
- VAT return matches expected output for a fixture set of transactions
- Reports filtered by company include only that company's data
- A closed period's reports do not change when new transactions are added later (period locking enforced at the report level too)

### 9.8 Custom fields

- Field values save and retrieve correctly per record
- Fields render grouped into the correct tabs and sections
- Bilingual labels display according to the user's locale
- Required custom fields block save when empty
- Conditional visibility correctly shows and hides fields based on configuration

### 9.9 PDF generation

- Invoice PDF includes all required fields and is structurally valid
- Bilingual PDF renders RTL layout correctly when locale is Arabic
- PDF generation handles edge cases without crashing (empty optional fields, very long names, many line items, negative amounts, zero-amount lines)

### 9.10 Integrations

- Stripe webhook handlers update subscription state correctly for each event type
- ASP submission failures are retried and reported accurately
- Email sending failures are logged and do not crash the request that triggered them
- Bank statement imports handle malformed rows gracefully without losing valid data

---

## 10. Working Standards

- All code in version control (Git); branches per feature, merged to `main` when complete
- Every change in `main` ships with tests; CI must be green before merge
- Database migrations are version-controlled and reversible where practical
- Financial logic test coverage is a hard requirement, not a target
- Architectural decisions captured as lightweight Architecture Decision Records (ADRs) in the repository
- Secrets are never committed; environment variables only
- Production deployments happen via CI from `main`, not from local machines
- Code style enforced by automated linting and formatting

---

## 11. Open Decisions

Pending decisions, listed so they don't bottleneck a phase when reached:

- **Brand and domain name** — needed before Phase 2 deployment
- **Email sender domain and DMARC configuration** — needed for Phase 2 trust signals
- **Tenant subdomain naming policy** — reserved words, length, allowed characters
- **VAT-non-registered business handling** — businesses below the AED 375,000 mandatory VAT threshold
- **Final plan tiers and pricing** — placeholder structure documented; market-validated numbers required before Stripe products are created
- **ASP shortlist for Phase 3** — preliminary evaluation of two or three FTA-accredited service providers based on API quality and pricing
