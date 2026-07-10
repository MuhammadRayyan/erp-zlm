# AccountERP — UAE Accounting & ERP Software (Multi-Tenant SaaS Edition)

A modern, multi-tenant accounting ERP inspired by Manager.io, Odoo, and ERPNext, built for **UAE VAT compliance** and **FTA e-invoicing** (PINT AE). Runs locally on Windows/Mac/Linux and deploys as SaaS.

## Key Features

### Multi-Tenant SaaS Architecture
- **Tenant isolation** — every organization's data is isolated via `tenantId` row-level security
- **Subscription plans** — Free, Starter, Professional, Enterprise with business/user limits
- **License management** — generate and revoke license keys for self-hosted deployments
- **Platform admin portal** — manage all tenants, licenses, plans, and view platform-wide stats
- **Tenant admin portal** — manage users, businesses, and subscription within an organization

### User Management & Permissions
- **Role-based access control**: Platform Admin, Tenant Admin, Accountant, Viewer
- **Multi-tenant users** — one user account can belong to multiple organizations
- **Business switcher** — manage multiple businesses within a tenant
- **Plan limit enforcement** — cannot exceed businesses/users limits

### Complete Accounting
- **Double-entry bookkeeping** with server-side validation (debits = credits)
- **Chart of Accounts** — hierarchical, UAE-standard template pre-seeded (46 accounts)
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
- **UAE Compliant PDF template** — with TRN boxes, VAT breakdown, Arabic labels

### Customizable PDF Templates (9 professional designs)
- **Modern Invoice** — clean, minimalist, emerald accent
- **Classic Invoice** — traditional, serif, navy, formal
- **UAE Compliant Invoice** — FTA Tax Invoice with TRN boxes and VAT breakdown
- **Minimal Invoice** — ultra-clean, black & white
- **Bold Invoice** — modern gradient, eye-catching
- **Professional Quotation** — with validity and acceptance signatures
- **Professional Credit Note** — with reason and original invoice reference
- **Professional Delivery Note** — no prices, 3 signature blocks
- All editable via visual HTML/CSS editor with live preview

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

# Initialize database (creates SQLite + seeds test data on first app load)
bun run db:push

# Start the development server
bun run dev
```

Open http://localhost:3000 — the app auto-seeds:
- 4 subscription plans (Free, Starter, Professional, Enterprise)
- 1 Platform Admin account
- 3 test tenants with users, businesses, and sample data
- UAE chart of accounts, VAT rates, currencies, PDF templates

**Default login**: `admin@accounterp.com` / `Admin@123456`

See **TEST_CREDENTIALS.md** for all test accounts.

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
docker build -t accounterp .
docker run -d --name accounterp -p 3000:3000 -v accounterp_data:/app/data accounterp
```

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | Prisma ORM + SQLite (dev) / PostgreSQL (prod) |
| Money Math | decimal.js (never floating point) |
| Auth | bcrypt + JWT (HTTP-only cookies) |
| UI | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts |
| PDF | HTML/CSS templates + browser print |
| Icons | lucide-react |
| Container | Docker + docker-compose |

## Architecture

```
Platform Admin (you)
  └── Manages: Tenants, Licenses, Plans, Platform Stats
       │
       ▼
Tenant (customer organization)
  └── Has: Subscription + Plan (limits)
       └── Manages: Users (roles), Businesses
            │
            ▼
       Business (company)
            └── Contains: Chart of Accounts, Invoices, Bills, Payments, etc.
```

### Tenant Isolation
- Every business-scoped table has a `tenantId` column
- Every API route verifies the current user's tenant matches the requested resource's tenant
- Platform Admin can access any tenant (for support/management)
- Regular users can only access their assigned tenant(s)

### Security
- Passwords hashed with bcrypt (10 rounds)
- JWT sessions (7-day expiry) in HTTP-only cookies
- `sameSite=lax` CSRF protection
- Zod input validation on all API routes
- Prisma parameterized queries (SQL injection protection)
- Permission checks on all mutating operations

## Test Accounts

See **TEST_CREDENTIALS.md** for complete credentials and UAT testing procedures.

| Role | Email | Password |
|---|---|---|
| Platform Admin | `admin@accounterp.com` | `Admin@123456` |
| Tenant Admin (Tech Solutions) | `owner@techsolutions.ae` | `Owner@123456` |
| Accountant (Tech Solutions) | `accountant@techsolutions.ae` | `Account@123` |
| Viewer (Tech Solutions) | `viewer@techsolutions.ae` | `Viewer@123` |
| Tenant Admin (Al Madina) | `owner@almadina.ae` | `Madina@123` |
| Tenant Admin (Startup Fresh) | `founder@startupfresh.ae` | `Startup@123` |

## Switching to PostgreSQL (for Production SaaS)

1. Update `prisma/schema.prisma`:
   ```prisma
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
   ```bash
   bun run db:push
   ```

## Deployment Options

### VPS (DigitalOcean, Hetzner, Contabo)
```bash
git clone <repo> && cd accounterp
docker-compose up -d
```

### Railway / Render
- Connect repo
- Add PostgreSQL add-on
- Set `DATABASE_URL` and `JWT_SECRET`
- Deploy

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | Database connection string | `file:./db/custom.db` |
| `JWT_SECRET` | Secret for JWT token signing | (set in production!) |
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |

## License

Private — for personal and commercial use.

---

Built with Next.js, Prisma, decimal.js, bcrypt, JWT, and shadcn/ui.
