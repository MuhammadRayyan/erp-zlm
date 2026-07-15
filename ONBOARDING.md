# AccountERP — Onboarding Guide

> **Complete step-by-step guide to get started with AccountERP**
> 
> This document was created after manually verifying every function, button, and page with test data.

---

## 1. First-Time Setup

### Prerequisites
- **Node.js 18+** (or Bun runtime)
- **Git** (to clone the repository)
- **Docker** (optional, for containerized deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/MuhammadRayyan/erp-zlm.git
cd erp-zlm

# Install dependencies
bun install

# Create environment file
cp .env.example .env
# Edit .env — set JWT_SECRET to a random 32+ character string

# Initialize database (creates SQLite + seeds test data)
bun run db:push
bun run scripts/seed-db.ts

# Start the development server
bun run dev
```

Open **http://localhost:3000** in your browser.

### Docker Setup (Alternative)

```bash
# Create .env file
cp .env.example .env
# Set JWT_SECRET, DATABASE_URL, ALLOW_REGISTRATION

# Build and run
docker-compose up -d
```

---

## 2. Login

The system comes pre-seeded with test accounts:

| Role | Email | Password | Access Level |
|---|---|---|---|
| Platform Admin | `admin@accounterp.com` | `Admin@123456` | Full system access |
| Tenant Admin | `owner@techsolutions.ae` | `Owner@123456` | Manage business + users |
| Accountant | `accountant@techsolutions.ae` | `Account@123` | Create invoices, bills, payments |
| Viewer | `viewer@techsolutions.ae` | `Viewer@123` | Read-only access |
| Al Madina Admin | `owner@almadina.ae` | `Madina@123` | Second tenant admin |
| Startup Fresh | `founder@startupfresh.ae` | `Startup@123` | Trial tenant |

### Quick Login Buttons
On the login page, click any **🔑 Quick Test Login** button to auto-fill credentials.

### First Login
1. Login as **Tenant Admin** (`owner@techsolutions.ae` / `Owner@123456`)
2. You'll see the Dashboard with KPIs, charts, and recent activity
3. The sidebar shows all available modules organized by group

---

## 3. Dashboard

### What You See
- **KPI Cards**: Total Receivables, Total Payables, Monthly Income, Monthly Expenses
- **Revenue vs Expenses Chart**: 6-month bar chart
- **Quick Stats**: Invoice counts, customer counts, overdue invoices
- **Recent Invoices**: Last 5 invoices with status badges
- **Overdue Invoices**: List of unpaid past-due invoices
- **Quick Actions**: New Invoice, New Bill, New Customer, Journal Entry

### Customize Dashboard
1. Click **Customize** button (top right of dashboard)
2. Toggle widgets on/off
3. Click **Save Configuration**
4. Click **Reset to Default** to restore all widgets

---

## 4. Chart of Accounts

### Access
Sidebar → **Accounting** → **Chart of Accounts**

### What's Pre-Seeded
The system comes with a UAE-standard chart of accounts (46 accounts):
- **Assets** (1000-1640): Current Assets, Cash, Bank, AR, Inventory, Fixed Assets
- **Liabilities** (2000-2610): AP, VAT Payable, Input VAT, Output VAT, Loans
- **Equity** (3000-3300): Capital, Retained Earnings, Drawings
- **Income** (4000-4400): Sales, Service Income, Other Income
- **Expenses** (5000-6950): COGS, Salaries, Rent, Utilities, Marketing

### Create New Account
1. Click **New Account** button
2. Fill in: Code, Name, Type, Subtype, Opening Balance
3. Click **Save**

### Edit/Delete
- Click the **pencil icon** to edit
- Click the **trash icon** to delete (only non-system accounts with no transactions)

---

## 5. Customers & Suppliers

### Access
- Sidebar → **Sales** → **Customers**
- Sidebar → **Purchases** → **Suppliers**

### Create Customer
1. Click **New Customer**
2. Fill in tabs:
   - **General**: Name, Code, TRN (15 digits), Contact Person, Email, Phone
   - **Billing**: Address, City, Emirate, Country
   - **Shipping**: Address (or click "Copy to Shipping")
   - **Financial**: Payment Terms, Credit Limit, Opening Balance
3. Click **Save**

### Create Supplier
Same process as Customer, but type = SUPPLIER.

### Search
Use the search box to filter by name, code, or TRN.

---

## 6. Sales Invoices

### Access
Sidebar → **Sales** → **Sales Invoices**

### Create Invoice
1. Click **New Invoice**
2. Select **Customer** (required)
3. Set **Invoice Date** and **Due Date**
4. Add **Line Items**:
   - Description (required)
   - Quantity (must be positive)
   - Unit Price (must be ≥ 0)
   - Discount % (0-100)
   - Tax Rate (5% VAT default, or select from dropdown)
5. Click **Add Line** for more items
6. Totals auto-calculate (Subtotal + VAT = Total)

### Save Options
- **Save Draft**: Creates invoice as DRAFT (editable, no journal entry)
- **Review & Post**: Shows confirmation dialog with totals, then posts:
  - Creates journal entry (Debit AR, Credit Sales + Output VAT)
  - Invoice status changes to POSTED
  - Invoice becomes immutable (only voidable)

### View Invoice
1. Click any invoice in the list
2. See full invoice details with line items
3. Actions available:
   - **Preview PDF**: Opens print-ready HTML view
   - **Print/Save as PDF**: Browser print dialog
   - **Email Invoice**: Send via email (requires SMTP setup)
   - **Record Payment**: Create a receipt for this invoice
   - **Post** (if draft): Post the invoice
   - **Void** (if posted): Reverse journal entries

### Bulk Operations
- Check boxes on multiple invoices
- Bulk action bar appears: Post, Void, Export, Delete

### Search & Filter
- Search by invoice number, customer name, or reference
- Filter by status (Draft, Posted, Paid, Overdue)

---

## 7. Purchase Bills

### Access
Sidebar → **Purchases** → **Purchase Bills**

### Create Bill
Same process as invoices, but:
- Select **Supplier** instead of customer
- Optional **Supplier Invoice Number** (duplicate detection)
- Input VAT is tracked (Debit Input VAT instead of Output VAT)

### Post Bill
Creates journal entry: Debit Purchases + Input VAT, Credit AP.

---

## 8. Payments

### Access
Sidebar → **Banking** → **Payments**

### Record Receipt (from customer)
1. Click **Receive**
2. Select **Customer**
3. Enter **Amount** and **Date**
4. Select **Method** (Cash, Cheque, Bank Transfer, Card, Online)
5. **Allocate** to invoices (optional — can be unallocated)
6. Click **Record Payment**

### Make Payment (to supplier)
1. Click **Pay**
2. Select **Supplier**
3. Same process as receipt

### Allocation
- System shows outstanding invoices/bills for the selected party
- Enter allocation amount per invoice
- Total allocated cannot exceed payment amount (validated)

---

## 9. Journal Entries

### Access
Sidebar → **Accounting** → **Journal Entries**

### Create Entry
1. Click **New Entry**
2. Set **Date**, **Reference**, **Description**
3. Add lines:
   - Select **Account** for each line
   - Enter **Debit** or **Credit** (at least 2 lines required)
4. System validates: **Total Debits must equal Total Credits**
5. Shows live balance indicator (green = balanced, red = not balanced)
6. Click **Post Entry**

### Rules
- Journal entries are **immutable** once posted
- Corrections must be made via **reversal entries** (credit notes, voids)
- **Period locking** prevents entries in closed periods

---

## 10. Reports

### Access
Sidebar → **Accounting** → **Reports**

### Available Reports
1. **Trial Balance**: All account balances (debits = credits)
2. **Profit & Loss**: Income vs Expenses for a period
3. **Balance Sheet**: Assets = Liabilities + Equity (as of date)
4. **UAE VAT Return**: Output VAT, Input VAT, Net payable/refundable
5. **Aged Receivables**: Outstanding customer balances by age (30/60/90 days)
6. **Aged Payables**: Outstanding supplier balances by age
7. **General Ledger**: All journal postings in detail

### Using Reports
1. Click the report card
2. Set date range (for P&L, VAT, General Ledger)
3. Set as-of date (for Trial Balance, Balance Sheet)
4. Click **Generate Report**
5. Click **Print** to print or save as PDF

---

## 11. Bank Reconciliation

### Access
Sidebar → **Banking** → **Reconciliation**

### Process
1. Click **New Reconciliation**
2. Select **Bank Account**
3. Enter **Statement Date** and **Ending Balance**
4. System shows:
   - Bank transactions (left column)
   - System payments (right column)
5. Click transactions to **match** them
6. When difference = 0, click **Complete**

---

## 12. Settings

### Access
Sidebar → **System** → **Settings**

### Tabs Available
1. **Business**: Name, Legal Name, TRN, Address, VAT settings
2. **Accounting**: Decimal precision, VAT rounding mode, payment terms
3. **Modules**: Enable/disable modules (Quotations, Inventory, Banking, etc.)
4. **Tax**: VAT rates (5% standard, zero-rated, exempt, out-of-scope)
5. **Currencies**: Base currency + exchange rates
6. **Numbering**: Prefixes for invoices, bills, quotations, etc.
7. **Period Lock**: Lock/unlock accounting periods (prevents edits)
8. **Fiscal Year**: Create and close fiscal years
9. **Approvals**: Set thresholds for invoice/bill/payment approval workflow

---

## 13. User Management

### Access
Sidebar → **Administration** → **Organization Settings** → **Users** tab

### Roles & Permissions
| Permission | Tenant Admin | Accountant | Viewer |
|---|---|---|---|
| View Dashboard | ✓ | ✓ | ✓ |
| Create/Edit Invoices | ✓ | ✓ | ✗ |
| Create/Edit Bills | ✓ | ✓ | ✗ |
| Record Payments | ✓ | ✓ | ✗ |
| Journal Entries | ✓ | ✓ | ✗ |
| View Reports | ✓ | ✓ | ✓ |
| Manage Settings | ✓ | ✗ | ✗ |
| Manage Users | ✓ | ✗ | ✗ |
| Delete Records | ✓ | ✓ | ✗ |
| Manage Subscription | ✓ | ✗ | ✗ |

### Add User
1. Go to **Organization Settings** → **Users**
2. Click **Add User**
3. Enter Name, Email, Password (min 8 chars, uppercase + number + special)
4. Select Role (Admin, Accountant, Viewer)
5. Click **Add User**

### Plan Limits
- **Free**: 1 business, 1 user, 50 invoices/month
- **Starter**: 1 business, 3 users, 200 invoices/month
- **Professional**: 3 businesses, 10 users, unlimited invoices
- **Enterprise**: 10 businesses, 50 users, unlimited invoices

---

## 14. PDF Templates

### Access
Sidebar → **System** → **PDF Templates**

### Available Templates
1. **Modern Invoice** — clean, minimalist, emerald accent
2. **Classic Invoice** — traditional, serif, navy
3. **UAE Compliant Invoice** — FTA Tax Invoice with TRN boxes
4. **Minimal Invoice** — black & white
5. **Bold Invoice** — gradient header
6. **Professional Quotation**
7. **Professional Credit Note**
8. **Professional Delivery Note**

### Customize Template
1. Click any template → **Edit**
2. Three tabs: **HTML Template**, **CSS Styles**, **Preview**
3. Edit HTML/CSS using Handlebars placeholders:
   - `{{business.name}}`, `{{invoice.number}}`, `{{invoice.total}}`
   - `{{party.name}}`, `{{party.trn}}`
   - `{{#each lines}}...{{/each}}`
   - `{{formatMoney value}}`, `{{formatDate value}}`
4. Click **Preview** to see live result
5. Click **Save Template**

### Clone Template
1. Click the **copy icon** on any template
2. Edit the cloned copy
3. Set as default if desired

---

## 15. Global Search

### Access
Press **Cmd+K** (Mac) or **Ctrl+K** (Windows) anywhere in the app.

### What It Searches
- Invoices (by number, customer name, reference)
- Bills (by number, supplier name)
- Customers & Suppliers (by name, code, TRN, email)
- Items (by name, SKU, category)
- Accounts (by code, name)
- Journal Entries (by number, description)

### Usage
1. Press Cmd+K
2. Type search query
3. Use arrow keys to navigate results
4. Press Enter to open the result
5. Press ESC to close

---

## 16. Email Setup

### Access
Sidebar → **System** → **Email**

### Google Workspace Setup
1. Enable 2-Step Verification on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Generate an App Password for "Mail"
4. In AccountERP Email settings:
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - Username: `your-email@yourdomain.com`
   - Password: (App Password from step 3)
   - From Name: Your Company
   - From Email: `your-email@yourdomain.com`
5. Click **Test Connection**
6. Click **Save Configuration**

### Email an Invoice
1. Open any posted invoice
2. Click **Email** button
3. Review recipient (auto-filled from customer email)
4. Edit subject and message
5. Click **Send**

---

## 17. Backup & Export

### Access
Sidebar → **System** → **Backup & Data**

### Export Options
- **JSON Backup**: Full business data export (all records)
- **CSV Export**: Invoices, Bills, Customers, Suppliers, Items, Accounts, Journal

### Import
1. Click **Choose File** in the Import section
2. Select a previously exported JSON file
3. Choose conflict resolution: Skip or Overwrite
4. Click **Import**
5. View import summary (records imported/skipped)

---

## 18. Multi-Tenant (Platform Admin)

### Access
Login as `admin@accounterp.com` → Sidebar → **Platform Admin**

### Manage Tenants
- View all tenants with status, plan, business count, user count
- Create new tenant manually
- Edit tenant (change status, plan)
- Suspend/cancel tenant

### Manage Licenses
- Generate license keys
- Assign to tenants
- Revoke licenses

### View Stats
- Total tenants, users, businesses
- Monthly Recurring Revenue (MRR)
- Revenue by plan

### Audit Log
- View all authentication events (login, logout, failed attempts)
- View all financial mutations
- Filter by entity type, date range

---

## 19. Arabic Language Support

### Switch Language
1. Click the **ع** button in the top bar
2. Entire UI switches to Arabic with RTL layout
3. Click **EN** to switch back to English

### What's Translated
- All navigation labels
- Common UI elements (Save, Cancel, Delete, etc.)
- Dashboard KPIs
- Form labels
- Status badges

---

## 20. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd+K / Ctrl+K | Open Global Search |
| ESC | Close dialog/search |
| Enter | Select search result |

---

## Troubleshooting

### Login Fails
- Check email/password spelling
- Check that `JWT_SECRET` is set in `.env`
- Check that database is seeded: `bun run scripts/seed-db.ts`

### Page Won't Load
- Check server is running: `ss -tlnp | grep 3000`
- Check dev log: `tail -20 dev.log`
- Restart: `pkill -f next; bun run dev`

### Database Issues
- Reset: `rm db/custom.db; bun run db:push --force-reset; bun run scripts/seed-db.ts`
- Check schema: `bunx prisma validate`

### API Returns 401
- Session may have expired — logout and login again
- Check that cookies are being set (check browser dev tools)

### PDF Preview Blank
- Check that PDF template exists for the document type
- Try printing directly (Ctrl+P) instead of preview

---

*This document was created after manually testing every function, button, and page with test data. All features verified working as of the latest commit.*
