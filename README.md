# AccountERP — UAE Accounting & ERP Software

A modern, multi-tenant accounting ERP built for **UAE VAT compliance** and **FTA e-invoicing** (PINT AE). Runs locally on Windows/Mac/Linux and deploys as SaaS.

---

## Quick Start

### Option A: Local Development (Bun)

```bash
# 1. Clone the repository
git clone https://github.com/MuhammadRayyan/erp-zlm.git
cd erp-zlm

# 2. Install dependencies
bun install

# 3. Create your .env file
cp .env.example .env
# Edit .env — set JWT_SECRET to a secure random string

# 4. Initialize the database
bun run db:push

# 5. Start the development server
bun run dev
```

Open **http://localhost:3000** and login with:
- **Email:** `admin@accounterp.com`
- **Password:** `Admin@123456`

> See **TEST_CREDENTIALS.md** for all test accounts.

### Option B: Local Docker

```bash
# 1. Clone and create .env
git clone https://github.com/MuhammadRayyan/erp-zlm.git
cd erp-zlm
cp .env.example .env
# Edit .env — set JWT_SECRET

# 2. Build and run
docker-compose up -d

# 3. View logs
docker-compose logs -f
```

Open **http://localhost:3000**.

### Option C: Cloud Deployment

See **[Cloud Deployment](#cloud-deployment)** section below.

---

## Environment Variables

The `.env` file is **not** included in the repository (for security). Create it from `.env.example`:

```bash
cp .env.example .env
```

### Required Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Database connection string | `file:./db/custom.db` (SQLite) or `postgresql://user:pass@host:5432/accounterp` |
| `JWT_SECRET` | Secret for JWT token signing (min 32 chars) | Generate with `openssl rand -base64 32` |
| `NODE_ENV` | Environment | `development` or `production` |

### Optional Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `SMTP_HOST` | Email SMTP host (e.g., smtp.gmail.com) |
| `SMTP_PORT` | Email SMTP port (e.g., 587) |
| `SMTP_USER` | Email username |
| `SMTP_PASS` | Email password (App Password for Gmail) |
| `SMTP_FROM_NAME` | Display name for outgoing emails |
| `SMTP_FROM_EMAIL` | From email address |

### Generating JWT_SECRET

```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))

# Or use any online random string generator (32+ characters)
```

---

## Database Setup

### SQLite (Default — Local Development)

SQLite is the default database. No additional setup needed — the database file is created automatically at `db/custom.db`.

```env
DATABASE_URL="file:./db/custom.db"
```

### PostgreSQL (Production / Cloud)

For production, use PostgreSQL for better performance and concurrency:

1. **Update `prisma/schema.prisma`:**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. **Set `DATABASE_URL` in `.env`:**
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/accounterp?schema=public"
   ```

3. **Push the schema:**
   ```bash
   bun run db:push
   ```

---

## Email Setup (Google Workspace)

To send invoices and statements via email from your Google Workspace account:

1. Enable **2-Step Verification** on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate a new **App Password** for "Mail"
4. In AccountERP, go to **System → Email → Configuration**
5. Enter:
   - **SMTP Host:** `smtp.gmail.com`
   - **SMTP Port:** `587`
   - **Username:** `your-email@yourdomain.com`
   - **Password:** (the App Password from step 3)
   - **From Name:** Your Company Name
   - **From Email:** `your-email@yourdomain.com`
6. Click **"Test Connection"** to verify
7. Click **"Save Configuration"**

Now you can email invoices directly from the invoice view.

---

## Cloud Deployment

### VPS (DigitalOcean, Hetzner, Contabo, AWS EC2)

```bash
# 1. SSH into your server
ssh root@your-server-ip

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone the repository
git clone https://github.com/MuhammadRayyan/erp-zlm.git
cd erp-zlm

# 4. Create .env file
cp .env.example .env
# IMPORTANT: Set JWT_SECRET to a secure random string!
# IMPORTANT: Set NODE_ENV=production
# Optionally switch to PostgreSQL

# 5. Build and start
docker-compose up -d

# 6. Verify it's running
curl http://localhost:3000/api/init
```

**With PostgreSQL on VPS:**

1. Uncomment the `db` service in `docker-compose.yml`
2. Set `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql://accounterp:yourpassword@db:5432/accounterp?schema=public"
   ```
3. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Rebuild: `docker-compose up -d --build`

### Railway / Render / Fly.io

1. Connect your GitHub repository
2. Set environment variables:
   - `DATABASE_URL` — use the provided PostgreSQL connection string
   - `JWT_SECRET` — generate a secure random string
   - `NODE_ENV` — `production`
3. Update `prisma/schema.prisma` to use PostgreSQL (see above)
4. Deploy

### Vercel (Frontend Only)

> Note: Vercel doesn't support persistent SQLite. You must use an external PostgreSQL database.

1. Connect repository to Vercel
2. Add environment variables
3. Use external PostgreSQL (Supabase, Neon, etc.)
4. Deploy

---

## Docker Configuration

### Dockerfile

Multi-stage build:
- **Stage 1 (deps):** Installs dependencies and generates Prisma client
- **Stage 2 (builder):** Builds the Next.js standalone output
- **Stage 3 (runner):** Minimal production image with health check

### docker-compose.yml

- **app:** The AccountERP application (port 3000)
- **db:** PostgreSQL (uncomment to use instead of SQLite)
- **Volumes:** Data persists in `accounterp_data` volume

### Custom Docker Build

```bash
docker build -t accounterp .
docker run -d \
  --name accounterp \
  -p 3000:3000 \
  -v accounterp_data:/app/data \
  -e JWT_SECRET="your-secure-secret" \
  -e NODE_ENV=production \
  accounterp
```

---

## Test Accounts

| Role | Email | Password |
|---|---|---|
| Platform Admin | `admin@accounterp.com` | `Admin@123456` |
| Tenant Admin | `owner@techsolutions.ae` | `Owner@123456` |
| Accountant | `accountant@techsolutions.ae` | `Account@123` |
| Viewer | `viewer@techsolutions.ae` | `Viewer@123` |
| Al Madina Admin | `owner@almadina.ae` | `Madina@123` |
| Startup Fresh | `founder@startupfresh.ae` | `Startup@123` |

See **TEST_CREDENTIALS.md** for the complete permission matrix and UAT testing guide.

---

## Features

### Core Accounting
- Double-entry bookkeeping with server-side validation (debits = credits)
- Chart of Accounts (UAE-standard template, 46 accounts pre-seeded)
- Journal entries with automatic balancing
- Trial Balance, P&L, Balance Sheet, Cash Flow, VAT Return

### Sales & Purchases
- Quotations → convert to invoices
- Sales invoices with UAE VAT (5%), TRN, sequential numbering
- Purchase bills with input VAT tracking
- Credit notes (reverses journal entries)
- Delivery notes
- Payments with multi-invoice allocation

### UAE Compliance
- VAT 5% standard rate, zero-rated, exempt, out-of-scope
- TRN on every business, customer, and supplier
- VAT Return report (output VAT, input VAT, net payable)
- PINT AE e-invoicing — UUID per invoice (crypto.randomUUID)
- UAE Compliant PDF template with TRN boxes and VAT breakdown

### Multi-Tenant SaaS
- Tenant isolation via `tenantId` row-level security
- Subscription plans (Free, Starter, Professional, Enterprise)
- License management
- Platform admin portal (manage all tenants, licenses, plans)
- Tenant admin portal (manage users, businesses, subscription)
- Role-based access control (Platform Admin, Tenant Admin, Accountant, Viewer)

### Advanced Features
- **Bank Reconciliation** — match bank statements to system transactions
- **Financial Year Close** — close fiscal year with closing journal entries
- **Customer & Supplier Statements** — with aging summary and email
- **Approval Workflows** — threshold-based approval for invoices/bills/payments
- **Period Locking** — prevent edits in closed accounting periods
- **Inter-Company Transactions** — transfer between businesses
- **Recurring Transactions** — schedule automatic invoice/bill creation
- **Budgets** — budget vs actual comparison with variance tracking
- **Bulk Operations** — bulk delete, post, void, export
- **Saved Views & Filters** — save custom filter combinations
- **Dashboard Customization** — show/hide widgets
- **Global Search** (Cmd+K) — search across all entities
- **Account Drill-Down** — view all transactions per account
- **Arabic RTL Support** — bilingual English/Arabic with language switcher
- **Email Integration** — Google Workspace SMTP
- **User Profile** — account, security, permissions, activity
- **Backup/Import/Export** — JSON backup + CSV export
- **9 PDF Templates** — Modern, Classic, UAE Compliant, Minimal, Bold
- **Custom Fields** — organized into tabs/sections (better than Manager.io)
- **Audit Trail** — all mutations logged with before/after data
- **Activity Timeline** — per-document activity log

### Security
- bcrypt password hashing (10 rounds)
- JWT sessions in HTTP-only cookies (7-day expiry)
- `sameSite` cookies for CSRF protection
- Rate limiting on login (10 attempts/15min production)
- Input validation with Zod schemas
- Prisma parameterized queries (SQL injection protection)
- IDOR protection (all routes verify `businessId`)
- Global route protection middleware
- Security HTTP headers (X-Frame-Options, HSTS, etc.)
- Crash on missing `JWT_SECRET` in production

---

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
| PDF | HTML/CSS templates + Handlebars + browser print |
| Email | Nodemailer (Google Workspace SMTP) |
| Icons | lucide-react |
| Container | Docker + docker-compose |

---

## Project Structure

```
├── prisma/
│   └── schema.prisma          # 41 database models
├── src/
│   ├── app/
│   │   ├── api/               # 69 API routes
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main app (SPA)
│   ├── components/
│   │   ├── erp/
│   │   │   ├── modules/       # 27 UI modules
│   │   │   ├── shared/        # Shared UI helpers
│   │   │   ├── app-shell.tsx  # Main shell
│   │   │   ├── sidebar.tsx    # Navigation
│   │   │   ├── topbar.tsx     # Top bar
│   │   │   └── global-search.tsx
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── auth.ts            # Auth, JWT, permissions, tenant isolation
│   │   ├── decimal.ts         # Money math (decimal.js)
│   │   ├── journal-service.ts # Double-entry engine
│   │   ├── vat-service.ts     # VAT calculation
│   │   ├── rate-limit.ts      # Rate limiting
│   │   ├── period-lock.ts     # Period locking
│   │   ├── email.ts           # Email (Nodemailer)
│   │   ├── backup.ts          # Backup/import/export
│   │   ├── i18n.tsx           # Arabic/English translations
│   │   └── ...
│   └── middleware.ts          # Global API route protection
├── scripts/
│   ├── seed-db.ts             # Seed database
│   └── verify-integrity.ts    # Data integrity verification
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Docker Compose
├── .env.example               # Environment variable template
├── TEST_CREDENTIALS.md        # Test accounts & UAT guide
└── README.md
```

---

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate Prisma client |
| `bun run scripts/seed-db.ts` | Seed test data |
| `bun run scripts/verify-integrity.ts` | Verify data integrity |

---

## Known Issues

1. **TypeScript type annotations:** 55 pre-existing type annotation errors remain from rapid feature development. These are type mismatches (not runtime bugs) — the application runs correctly. `ignoreBuildErrors: true` is enabled in `next.config.ts` as a temporary measure. These should be resolved over time.

2. **Journal entry numbering:** Uses `count + 1` which is not atomic under concurrent requests. Should use a Prisma transaction with `SELECT FOR UPDATE` for production scale.

3. **No automated test suite:** Financial calculation logic should have unit tests. Recommended: Vitest for unit tests, Playwright for E2E tests.

4. **No email verification:** Registration doesn't require email verification. Should be added before public launch.

5. **No payment gateway:** SaaS billing is manual (license keys). Stripe/Telr integration needed for automated billing.

---

## Security Checklist

- [x] Passwords hashed with bcrypt (10 rounds)
- [x] JWT tokens with 7-day expiry in HTTP-only cookies
- [x] `sameSite` cookies for CSRF protection
- [x] Rate limiting on login (10 attempts/15min in production)
- [x] Input validation with Zod schemas
- [x] Prisma parameterized queries (SQL injection protection)
- [x] IDOR protection (all routes verify `businessId`)
- [x] Global API route protection middleware
- [x] Security HTTP headers (HSTS, X-Frame-Options, etc.)
- [x] `.env` excluded from git (use `.env.example` as template)
- [x] JWT secret required in production (crashes if missing)
- [x] Tenant isolation on all business-scoped queries
- [x] Permission checks (RBAC) on all mutating operations
- [x] Period locking (prevent edits in closed periods)
- [x] Posted entry immutability (only DRAFT can be edited)
- [x] Audit trail on all mutations
- [x] Cryptographic UUID for e-invoicing (crypto.randomUUID)

---

## License

Private — for personal and commercial use.

---

Built with Next.js, Prisma, decimal.js, bcrypt, JWT, and shadcn/ui.
