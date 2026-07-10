# AccountERP — Test Credentials & UAT Testing Guide

This document contains all test accounts, passwords, and testing procedures for AccountERP.

> ⚠️ **WARNING**: These credentials are for testing only. Change all passwords before production deployment.

---

## Test Accounts

### Platform Admin (Full System Access)

| Field | Value |
|---|---|
| **Email** | `admin@accounterp.com` |
| **Password** | `Admin@123456` |
| **Role** | PLATFORM_ADMIN |
| **Access** | Full system access — manage all tenants, licenses, plans, users |

---

### Tenant 1: Tech Solutions LLC (Professional Plan)

| Field | Value |
|---|---|
| **Organization** | Tech Solutions LLC |
| **Slug** | `tech-solutions` |
| **Plan** | Professional (3 businesses, 10 users) |
| **Status** | ACTIVE |

**Users:**

| Role | Email | Password | Name |
|---|---|---|---|
| Tenant Admin | `owner@techsolutions.ae` | `Owner@123456` | Ahmed Al Rashid |
| Accountant | `accountant@techsolutions.ae` | `Account@123` | Fatima Al Zahra |
| Viewer | `viewer@techsolutions.ae` | `Viewer@123` | John Smith |

**Businesses:**
1. **Tech Solutions LLC** — TRN: 100123456700003, Dubai, VAT Registered (5%)
   - 3 sample invoices (1 draft, 1 posted/partially paid, 1 posted/paid)
   - 1 sample purchase bill (posted, unpaid)
   - 1 receipt payment
   - 3 customers, 2 suppliers, 3 inventory items
   - Bank account: Emirates NBD (balance: 31,300 AED)
2. **Tech Solutions Trading** — TRN: 100123456700011, Dubai, VAT Registered (5%)
   - Fresh business (no transactions yet)

---

### Tenant 2: Al Madina Trading (Starter Plan)

| Field | Value |
|---|---|
| **Organization** | Al Madina Trading |
| **Slug** | `al-madina-trading` |
| **Plan** | Starter (1 business, 3 users) |
| **Status** | ACTIVE |

**Users:**

| Role | Email | Password | Name |
|---|---|---|---|
| Tenant Admin | `owner@almadina.ae` | `Madina@123` | Omar Al Madina |
| Accountant | `accounts@almadina.ae` | `Account@123` | Sara Ahmed |

**Businesses:**
1. **Al Madina Trading** — TRN: 100987654300003, Sharjah, VAT Registered (5%)
   - Same sample data structure as Tech Solutions LLC

---

### Tenant 3: Startup Fresh (Free Plan — Trial)

| Field | Value |
|---|---|
| **Organization** | Startup Fresh |
| **Slug** | `startup-fresh` |
| **Plan** | Free (1 business, 1 user) |
| **Status** | TRIAL (10 days remaining) |

**Users:**

| Role | Email | Password | Name |
|---|---|---|---|
| Tenant Admin | `founder@startupfresh.ae` | `Startup@123` | Khalid Mohammed |

**Businesses:**
1. **Startup Fresh** — No TRN, NOT VAT registered (below threshold)

---

## Permission Matrix

| Permission | Platform Admin | Tenant Admin | Accountant | Viewer |
|---|---|---|---|---|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| Create/Edit Invoices | ✅ | ✅ | ✅ | ❌ |
| Create/Edit Bills | ✅ | ✅ | ✅ | ❌ |
| Create/Edit Payments | ✅ | ✅ | ✅ | ❌ |
| Create Journal Entries | ✅ | ✅ | ✅ | ❌ |
| View Reports | ✅ | ✅ | ✅ | ✅ |
| Manage Business Settings | ✅ | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ✅ | ❌ | ❌ |
| Manage Businesses | ✅ | ✅ | ❌ | ❌ |
| Manage Subscription | ✅ | ✅ | ❌ | ❌ |
| Manage Custom Fields | ✅ | ✅ | ❌ | ❌ |
| Manage PDF Templates | ✅ | ✅ | ❌ | ❌ |
| Manage All Tenants | ✅ | ❌ | ❌ | ❌ |
| Manage Licenses | ✅ | ❌ | ❌ | ❌ |
| Manage Plans | ✅ | ❌ | ❌ | ❌ |

---

## UAT Test Scenarios

### 1. Authentication & Authorization

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 1.1 | Login as Platform Admin | Login with admin@accounterp.com | Dashboard loads, "Platform Admin" in sidebar |
| 1.2 | Login as Tenant Admin | Login with owner@techsolutions.ae | Dashboard loads with Tech Solutions LLC data |
| 1.3 | Login as Accountant | Login with accountant@techsolutions.ae | Dashboard loads, no admin portal link |
| 1.4 | Login as Viewer | Login with viewer@techsolutions.ae | Dashboard loads, no System section in sidebar |
| 1.5 | Invalid login | Login with wrong password | "Invalid email or password" error |
| 1.6 | Logout | Click Logout button | Returns to login screen |
| 1.7 | Register new tenant | Register with new email/org | Account created, 14-day trial starts |

### 2. Tenant Isolation

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 2.1 | Tech Solutions data isolated | Login as Tech Solutions admin → view invoices | Only Tech Solutions invoices visible |
| 2.2 | Al Madina data isolated | Login as Al Madina admin → view invoices | Only Al Madina invoices visible |
| 2.3 | Switch tenant (Platform Admin) | Platform Admin → switch to Al Madina | Sees Al Madina data |
| 2.4 | Switch business | Select different business in topbar | Business context changes |

### 3. Sales Cycle (End-to-End)

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 3.1 | Create customer | Customers → New Customer → fill details → Save | Customer appears in list |
| 3.2 | Create quotation | Quotations → New Quotation → add lines → Save | Quotation created with number QT-000001 |
| 3.3 | Create draft invoice | Invoices → New Invoice → add lines → Save Draft | Invoice created as DRAFT |
| 3.4 | Post invoice | Open draft invoice → Post | Status changes to POSTED, journal entry created |
| 3.5 | Verify journal entry | Chart of Accounts → check AR, Sales, Output VAT | AR debited, Sales & VAT credited |
| 3.6 | Record payment | Open posted invoice → Record Payment | Payment created, invoice marked PAID |
| 3.7 | Verify payment journal | Check Cash/Bank account increased, AR decreased | Correct journal posted |
| 3.8 | Create credit note | Credit Notes → New → link to invoice → Post | Credit note reverses journal entries |

### 4. Purchase Cycle

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 4.1 | Create supplier | Suppliers → New Supplier → Save | Supplier appears in list |
| 4.2 | Create bill | Bills → New Bill → add lines → Save & Post | Bill posted, AP credited, Purchases & Input VAT debited |
| 4.3 | Pay bill | Payments → Pay → select supplier → allocate to bill | Bill marked PAID |

### 5. Accounting & Reports

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 5.1 | Trial balance | Reports → Trial Balance | Debits = Credits (balanced) |
| 5.2 | Profit & Loss | Reports → P&L | Shows income, expenses, net profit |
| 5.3 | Balance sheet | Reports → Balance Sheet | Assets = Liabilities + Equity |
| 5.4 | VAT return | Reports → VAT Return | Shows output VAT, input VAT, net payable |
| 5.5 | Aged receivables | Reports → Aged Receivables | Shows outstanding customer balances by age |
| 5.6 | Manual journal | Journal → New Entry → 2+ lines → Post | Entry posted if balanced |
| 5.7 | Unbalanced journal | Journal → New Entry → unbalanced lines → Post | Error: "not balanced" |

### 6. PDF Templates

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 6.1 | View invoice PDF | Open invoice → Preview PDF | PDF renders with template |
| 6.2 | Print PDF | Click Print | Browser print dialog opens |
| 6.3 | Multiple templates | Templates → check list | 5+ invoice templates available |
| 6.4 | Clone template | Templates → clone → edit → Save | New template created |
| 6.5 | Set default | Templates → set one as default | Used for new PDFs |

### 7. Custom Fields

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 7.1 | Create field | Custom Fields → New → set tab/section/type → Save | Field appears grouped by tab/section |
| 7.2 | Field types | Create text, number, date, select fields | All render correctly |

### 8. Admin Portal (Platform Admin only)

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 8.1 | View tenants | Admin Portal → Tenants tab | All 3 tenants listed |
| 8.2 | Create tenant | Add Tenant → fill details → Save | New tenant created |
| 8.3 | Edit tenant | Edit tenant → change status → Save | Status updated |
| 8.4 | Generate license | Licenses → Generate → fill details | License key created |
| 8.5 | Revoke license | Licenses → revoke | Status changes to REVOKED |
| 8.6 | View revenue | Revenue tab | MRR calculated correctly |

### 9. Tenant Portal

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 9.1 | View users | Tenant Portal → Users | All tenant users listed |
| 9.2 | Add user | Add User → fill details → Save | User added (within plan limits) |
| 9.3 | Change role | Change user role via dropdown | Role updated |
| 9.4 | Remove user | Delete user | User removed from tenant |
| 9.5 | Add business | Businesses → Add → fill details | Business created (within plan limits) |
| 9.6 | View subscription | Subscription tab | Plan, usage, features shown |
| 9.7 | Upgrade plan | Click Upgrade on higher plan | Plan changes |

### 10. Plan Limit Enforcement

| # | Test | Steps | Expected Result |
|---|---|---|---|
| 10.1 | Business limit | On Free plan (1 business) → try adding 2nd | Error: "Business limit reached" |
| 10.2 | User limit | On Free plan (1 user) → try adding 2nd | Error: "User limit reached" |
| 10.3 | Downgrade blocked | Professional (3 businesses) → downgrade to Free (1) | Error: "Cannot downgrade" |

---

## Security Checklist

- [x] Passwords hashed with bcrypt (10 rounds)
- [x] JWT tokens with 7-day expiry
- [x] HTTP-only cookies (not accessible via JavaScript)
- [x] Tenant isolation on all API routes (tenantId scoping)
- [x] Permission checks on all mutating operations
- [x] Input validation with Zod schemas
- [x] SQL injection protection (Prisma parameterized queries)
- [x] CSRF protection (sameSite=lax cookies)
- [x] No sensitive data in URLs
- [x] Session cleared on logout

---

## Cloud Readiness Checklist

- [x] 12-factor app configuration (all config via environment variables)
- [x] Stateless API (sessions in JWT cookies)
- [x] Docker-ready (Dockerfile + docker-compose.yml)
- [x] Health check endpoint (via Next.js default)
- [x] Database switchable (SQLite → PostgreSQL via DATABASE_URL)
- [x] No hardcoded secrets (JWT_SECRET in env)
- [x] Production build optimization (Next.js standalone output)
- [x] Graceful error handling on all API routes

---

## How to Run Tests

### Quick Smoke Test
1. Start the app: `bun run dev`
2. Open http://localhost:3000
3. Login as Platform Admin: `admin@accounterp.com` / `Admin@123456`
4. Verify dashboard loads with sample data
5. Navigate through all modules via sidebar

### Full UAT
Follow the test scenarios above in order. Each scenario should pass before moving to the next.

### Reset Test Data
```bash
cd /home/z/my-project
rm db/custom.db
bun run db:push --force-reset
# Then visit the app — it auto-seeds on first load
```
