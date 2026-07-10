# AccountERP — UAE Accounting & ERP Software

A modern, self-hostable accounting ERP inspired by Manager.io, built for **UAE VAT compliance** and **FTA e-invoicing** (PINT AE). Runs locally on Windows/Mac/Linux and deploys as SaaS.

## Features

### Complete Accounting
- **Double-entry bookkeeping** with server-side validation (debits = credits)
- **Chart of Accounts** — hierarchical, UAE-standard template pre-seeded
- **Journal Entries** — manual entry with automatic balancing
- **General Ledger**, **Trial Balance**, **P&L**, **Balance Sheet**

### Sales Cycle
- **Quotations** → convert to invoices
- **Sales Invoices** with automatic VAT (5% UAE standard)
- **Credit Notes** linked to original invoices (reverses journal entries)
- **Delivery Notes** for goods tracking
- **Receipts** with multi-invoice allocation

### Purchase Cycle
- **Purchase Bills** with input VAT tracking
- **Supplier Payments** with bill allocation
- **Aged Payables** report

### UAE Compliance
- **VAT 5%** standard rate, zero-rated, exempt, out-of-scope categories
- **TRN field** on every business, customer, and supplier
- **VAT Return report** — output VAT, input VAT, net payable/refundable
- **PINT AE e-invoicing** — UUID generation per invoice, XML-ready structure
- VAT breakdown on all invoice PDFs

### Customizable PDF Templates
- **HTML/CSS-based** templates with Handlebars placeholders
- **Visual editor** with live preview
- Editable for: invoices, bills, quotations, credit notes, delivery notes
- Clone, customize, set defaults
- Print to PDF via browser (no Chrome/Puppeteer dependency)

### Better Custom Fields (improved over Manager.io)
- Organized into **Tabs → Sections → Fields** (not a flat list)
- Field types: text, number, decimal, date, select, checkbox, textarea, link
- Bilingual labels (English/Arabic)
- Per-doctype definitions (invoice, bill, party, item, etc.)

### Additional Modules
- **Inventory** — items, stock, reorder levels
- **Banking** — bank accounts, transactions, balances
- **Reports** — 7 financial reports including VAT return
- **Multi-currency** support with exchange rates
- **Settings** — business profile, tax rates, currencies, numbering

## Quick Start

### Option 1: Local Development

```bash
# Install dependencies
bun install

# Initialize database (creates SQLite + seeds UAE chart of accounts)
bun run db:push

# Start the development server
bun run dev
```

Open http://localhost:3000 in your browser. The app auto-seeds:
- Default business ("My Company")
- UAE chart of accounts (40+ accounts)
- VAT tax rates (5%, zero-rated, exempt, out-of-scope)
- Currencies (AED base + USD, EUR, GBP, SAR, INR, PKR)
- Default PDF templates

### Option 2: Docker (Recommended for Production)

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

Open http://localhost:3000. Data persists in a Docker volume.

### Option 3: Docker Build Only

```bash
# Build the image
docker build -t accounterp .

# Run the container
docker run -d \
  --name accounterp \
  -p 3000:3000 \
  -v accounterp_data:/app/data \
  accounterp
```

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | Prisma ORM + SQLite (dev) / PostgreSQL (prod) |
| Money Math | decimal.js (never floating point) |
| UI | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts |
| PDF | HTML/CSS templates + browser print |
| Icons | lucide-react |
| Container | Docker + docker-compose |

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (all backend logic)
│   │   ├── accounts/     # Chart of accounts CRUD
│   │   ├── bills/        # Purchase bills + actions
│   │   ├── business/     # Business settings
│   │   ├── custom-fields/# Custom field definitions
│   │   ├── dashboard/    # Dashboard KPIs
│   │   ├── delivery-notes/
│   │   ├── credit-notes/
│   │   ├── init/         # Database seeding
│   │   ├── invoices/     # Sales invoices + actions
│   │   ├── items/        # Inventory items
│   │   ├── journal/      # Journal entries
│   │   ├── parties/      # Customers & suppliers
│   │   ├── payments/     # Receipts & payments
│   │   ├── quotations/
│   │   ├── reports/      # Financial reports
│   │   ├── tax-rates/
│   │   └── templates/    # PDF templates
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main app (SPA)
├── components/
│   ├── erp/
│   │   ├── modules/      # All ERP modules
│   │   ├── shared/       # Shared UI helpers
│   │   ├── app-shell.tsx # Main shell
│   │   ├── sidebar.tsx   # Navigation
│   │   └── topbar.tsx
│   ├── ui/               # shadcn/ui components
│   └── theme-provider.tsx
└── lib/
    ├── constants.ts      # UAE chart of accounts, VAT categories
    ├── decimal.ts        # Money math (decimal.js)
    ├── journal-service.ts# Double-entry posting engine
    ├── vat-service.ts    # VAT calculation engine
    ├── seed.ts           # Database seeder
    ├── template-renderer.ts
    └── default-templates.ts
```

## Key Architectural Decisions

1. **Single entry point for money** — all financial mutations go through `postJournalEntry()` with decimal.js
2. **VAT never hardcoded** — `calculateVAT()` service, rate configurable per business
3. **Posted = immutable** — corrections via credit notes / reversal entries
4. **Template-driven PDFs** — HTML/CSS templates in DB, rendered with Handlebars, printed via browser
5. **Custom fields as data** — JSON definitions, not schema migrations
6. **SQLite for simplicity** — switch to PostgreSQL by changing `DATABASE_URL` only

## UAE Compliance Notes

- **VAT Rate**: 5% standard (configurable per business)
- **TRN**: 15-digit Tax Registration Number on all parties
- **E-Invoicing (PINT AE)**: UUID generated per invoice; XML structure ready for ASP integration
- **VAT Return**: Report shows output VAT (sales), input VAT (purchases), net payable/refundable
- **Retention**: 10 years for tax records (UAE requirement)

> Always verify compliance with a UAE tax advisor before production use.

## Switching to PostgreSQL (for SaaS)

1. Update `prisma/schema.prisma`:
   ```
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` in `.env`:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/accounterp"
   ```
3. Run:
   ```
   bun run db:push
   ```

## Deployment Options

### VPS (DigitalOcean, Hetzner, Contabo)
```bash
# SSH into server
git clone <repo> && cd accounterp
docker-compose up -d
```

### Vercel (frontend only, needs external DB)
- Connect repo to Vercel
- Set environment variables
- Use external PostgreSQL (Supabase, Neon, etc.)

### Railway / Render
- Connect repo
- Add PostgreSQL add-on
- Set `DATABASE_URL`
- Deploy

## License

Private — for personal and commercial use.

---

Built with Next.js, Prisma, decimal.js, and shadcn/ui.
