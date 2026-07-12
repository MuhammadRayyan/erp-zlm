# AccountERP — Full In-Depth Code Audit Report

**Repository:** [MuhammadRayyan/erp-zlm](https://github.com/MuhammadRayyan/erp-zlm)  
**Audit Date:** July 12, 2026  
**Auditor:** Perplexity AI  
**Project:** UAE Accounting & ERP Software (Multi-Tenant SaaS Edition)

---

## Executive Summary

AccountERP is a modern, multi-tenant ERP and accounting platform built with Next.js 16, TypeScript, Prisma ORM, and shadcn/ui — targeting UAE VAT compliance, FTA e-invoicing (PINT AE), and a SaaS business model. The core architecture is sound: double-entry bookkeeping is properly enforced, tenant isolation via `tenantId` row-level security is implemented throughout the schema, and sensitive operations use `bcrypt` + HTTP-only JWT cookies.

However, the audit identified **7 critical security vulnerabilities**, **8 functional bugs**, and **10 missing production-readiness features** that must be addressed before any commercial deployment. The most urgent issues are an `.env` file committed to the public repository and a hardcoded fallback JWT secret that would allow anyone to forge admin tokens in production.

---

## Technology Stack Review

| Layer | Technology | Verdict |
|---|---|---|
| Framework | Next.js 16 (App Router) | ✅ Excellent for SaaS |
| Language | TypeScript 5 | ✅ Correct choice |
| ORM | Prisma + SQLite (dev) / PostgreSQL (prod) | ✅ Good; ensure prod switch |
| Auth | bcrypt + JWT HTTP-only cookies | ⚠️ Add refresh tokens & rate limiting |
| Money Math | decimal.js | ✅ Correct; fix vat-service totals mixing |
| UI | Tailwind CSS 4 + shadcn/ui | ✅ Fast and professional |
| Runtime | Bun | ✅ Fast, modern |
| Container | Docker + Caddy + docker-compose | ✅ Production-ready |
| PDF | Handlebars HTML templates + browser print | ⚠️ Consider server-side PDF (Puppeteer/WeasyPrint) |
| Testing | None visible | ❌ No test suite — critical gap for financial software |

The stack is solid and well-chosen for a UAE SaaS product. The primary concern is the **complete absence of automated tests** for accounting logic, which is unacceptable for financial software where correctness is legally mandated.

---

## 🔴 Critical Security Vulnerabilities

### 1. `.env` File Committed to Public Repository

**File:** `.env`  
**Severity:** Critical

The `.env` file is committed directly to the public GitHub repository with a real absolute server filesystem path:

```
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

This leaks the server's directory structure. Any future `.env` containing `JWT_SECRET`, database credentials, or API keys would immediately be public. Remove the file from git history entirely (not just the working tree) and add `.env` to `.gitignore`:

```bash
git rm --cached .env
echo ".env" >> .gitignore
git commit -m "Remove .env from tracking"
```

Then use `git filter-branch` or `git-filter-repo` to purge it from all historical commits.

---

### 2. Hardcoded Fallback JWT Secret

**File:** `src/lib/auth.ts` — Line 5  
**Severity:** Critical

```ts
const JWT_SECRET = process.env.JWT_SECRET || 'accounterp-dev-secret-change-in-production'
```

If `JWT_SECRET` is not set in a production environment, the application silently falls back to a publicly visible hardcoded string. Anyone who reads this GitHub repository can forge valid JWT tokens and impersonate any user — including the Platform Admin. **Fix:**

```ts
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production')
  }
}
const SECRET = JWT_SECRET || 'dev-only-secret'
```

---

### 3. Missing Tenant Isolation on Resource Fetch by ID

**File:** `src/app/api/invoices/route.ts` — GET, PUT, DELETE handlers  
**Severity:** Critical

When fetching a single invoice by ID, the query does not verify that the invoice belongs to the current user's business or tenant:

```ts
// Vulnerable code
const invoice = await db.salesInvoice.findUnique({ where: { id } })
```

A user from Tenant A who knows (or guesses) the CUID of an invoice from Tenant B can read, modify, or delete it. The same vulnerability likely exists in `bills`, `quotations`, `credit-notes`, `payments`, and `delivery-notes` routes. **Fix:**

```ts
// Secure: always scope by businessId
const invoice = await db.salesInvoice.findFirst({
  where: { id, businessId }, // businessId is already verified to the current tenant
  include: { ... }
})
```

---

### 4. No Authentication Check on `DELETE /api/invoices`

**File:** `src/app/api/invoices/route.ts` — DELETE handler  
**Severity:** Critical

The `DELETE` handler has no `getSession()`, `requireAuth()`, or `ensureBusinessId()` call. The GET, POST, and PUT handlers all call `ensureBusinessId()` at the top, but DELETE does not — any unauthenticated HTTP client that knows a draft invoice's ID can delete it:

```ts
// Missing at the top of DELETE handler:
const businessId = await ensureBusinessId()
const session = await getSession()
if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
```

---

### 5. No Rate Limiting on Authentication Routes

**File:** `src/app/api/auth/login/route.ts`  
**Severity:** High

The login endpoint has no brute-force protection. An attacker can attempt unlimited password combinations without any delay or lockout. For a product selling to UAE businesses storing financial data, this is a critical gap.

**Recommended fix:** Add IP-based rate limiting using a middleware or a library like `next-rate-limit`. Allow a maximum of 5 failed attempts per IP per 15 minutes, with exponential backoff.

---

### 6. Missing HTTP-Only Flag on Tenant and Business Cookies

**File:** `src/lib/auth.ts` — `ensureTenantContext()` and `ensureBusinessId()`  
**Severity:** High

The session JWT cookie is correctly set with `httpOnly: true`, but the `TENANT_COOKIE` and `BUSINESS_COOKIE` are set without this flag:

```ts
cookieStore.set(TENANT_COOKIE, first.id, { path: '/', maxAge: 60 * 60 * 24 * 365 })
```

Without `httpOnly: true`, these cookies are readable by JavaScript and can be stolen via XSS. **Fix:** Add security flags to all auth-related cookies:

```ts
cookieStore.set(TENANT_COOKIE, first.id, {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
})
```

---

### 7. No Global Route Protection Middleware

**Severity:** High

There is no `middleware.ts` file at the Next.js root to globally guard authenticated routes. All authentication is handled per-route. This means one developer forgetting a single `getSession()` call in a new route equals a publicly accessible endpoint. A root-level `middleware.ts` should redirect unauthenticated requests to `/login` for all dashboard routes and return `401` for all `/api` routes, as a defense-in-depth layer.

---

## 🟠 Bugs & Logical Issues

### 8. Journal Entry Number Race Condition

**File:** `src/lib/journal-service.ts`  
**Severity:** High

```ts
const count = await db.journalEntry.count({ where: { businessId } })
const number = `JE-${String(count + 1).padStart(6, '0')}`
```

This is not atomic. Under concurrent requests (which are common in SaaS), two simultaneous journal entries will read the same `count` and generate the same number. Since `@@unique([businessId, number])` is enforced in the schema, one request will crash with a unique constraint violation instead of properly sequencing. The same race condition exists for invoice numbering in the invoices route.

**Fix:** Use a Prisma transaction to atomically increment and retrieve the sequence number, or rely on `autoincrement()` for sequential numbering.

---

### 9. VAT Totals Mix `decimal.js` with Native Floating-Point Arithmetic

**File:** `src/lib/vat-service.ts` — `calculateDocumentTotals()`  
**Severity:** High

Individual line calculations use `decimal.js` (correct), but document-level totals are summed with native JavaScript `+` (floating-point) and then rounded with `Math.round`:

```ts
// Bug: reverts to floating-point after using decimal.js on lines
const subtotal = calculated.reduce((s, l) => s + l.grossAmount, 0)
const totalTax = calculated.reduce((s, l) => s + l.taxAmount, 0)
return { subtotal: Math.round(subtotal * 100) / 100, ... }
```

This defeats the purpose of using `decimal.js` and can produce incorrect totals (e.g., AED 0.01 off) on invoices with many line items — a compliance issue for FTA submissions. **Fix:**

```ts
const subtotal = calculated.reduce((s, l) => s.plus(money(l.grossAmount)), money(0))
return { subtotal: toNumber(subtotal), ... }
```

---

### 10. E-Invoice UUID Uses Non-Cryptographic `Math.random()`

**File:** `src/lib/vat-service.ts` — `generateEInvoiceUuid()`  
**Severity:** Medium

```ts
return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0
  ...
})
```

`Math.random()` is not cryptographically secure and can be predicted. For PINT AE e-invoicing, UUIDs must be truly unique and unpredictable. **Fix:**

```ts
import { randomUUID } from 'crypto'
export function generateEInvoiceUuid(): string {
  return randomUUID()
}
```

---

### 11. `ignoreBuildErrors: true` Suppresses All TypeScript Errors

**File:** `next.config.ts`  
**Severity:** Medium

```ts
typescript: { ignoreBuildErrors: true }
```

TypeScript compilation errors are silently swallowed in production builds. Type errors that would prevent incorrect code from running are hidden. Remove this flag and resolve all existing TypeScript errors.

---

### 12. `reactStrictMode: false` Hides Real Bugs

**File:** `next.config.ts`  
**Severity:** Medium

React Strict Mode detects components with side effects in lifecycle methods, deprecated API usage, and unexpected re-renders. Disabling it for production hides real issues. Set `reactStrictMode: true`.

---

### 13. Invoice Voiding Only Reverses the First Journal Entry

**File:** `src/app/api/invoices/actions/route.ts`  
**Severity:** Medium

```ts
const je = await db.journalEntry.findFirst({ where: { sourceType: 'SALES_INVOICE', sourceId: id } })
if (je) await reverseJournalEntry(je.id, user.id, ...)
```

`findFirst` only retrieves one journal entry. A posted invoice may have multiple related journal entries (e.g., if partially paid). Only the first is reversed, leaving the ledger in an inconsistent state. **Fix:** Use `findMany` and reverse all related entries.

---

### 14. Registration Password Minimum is Too Weak

**File:** `src/app/api/auth/register/route.ts`  
**Severity:** Medium

```ts
password: z.string().min(6)
```

Six characters is insufficient for a business accounting platform. **Fix:** Require minimum 8 characters with complexity:

```ts
password: z.string()
  .min(8)
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a special character')
```

---

### 15. No Input Validation (Zod) on Admin Mutation Routes

**Files:** `src/app/api/admin/tenants/route.ts` POST/PUT, `src/app/api/admin/licenses/route.ts` POST  
**Severity:** Medium

Admin route mutation handlers access `body.name`, `body.email`, `body.planId`, etc. directly without Zod schema validation, unlike the auth routes. Unexpected field types can cause Prisma errors or unintended behavior. All routes that write to the database should validate input with Zod.

---

## 🟡 XSS / Injection Risk

### 16. Handlebars Template Rendering with User-Controlled HTML Content

**File:** `src/lib/template-renderer.ts`  
**Severity:** Medium

User-editable PDF templates are compiled and rendered via `Handlebars.compile(htmlContent)`. While Handlebars escapes double-brace `{{ }}` expressions, triple-brace `{{{ }}}` expressions render raw, unescaped HTML. If any default templates in `default-templates.ts` use `{{{ }}}` (common for rendering pre-formatted text or Arabic labels), and those fields can be populated by user input, this is a stored XSS vector.

**Action:** Audit all templates in `default-templates.ts` for `{{{ }}}` usage. Ensure any user-controlled values are only ever rendered via `{{ }}`. For the template editor itself, consider sandboxing with a Content Security Policy.

---

## 🟡 Architecture & Data Model Issues

### 17. `sqlite` Hardcoded in Prisma Schema

**File:** `prisma/schema.prisma`

```prisma
datasource db {
  provider = "sqlite"
  ...
}
```

The README instructs users to manually edit this file before production deployment. This is a deployment footgun — it's easy to forget, and deploying with SQLite on a multi-user SaaS is not viable. **Better practice:** Use an environment variable for the provider, or maintain a separate `schema.production.prisma` and a deploy script that swaps it automatically.

---

### 18. `customFields` Stored as Raw JSON Strings

**Models:** `Party`, `SalesInvoice`, `PurchaseBill`, `Item`, `Payment`, `DeliveryNote`, `CreditNote` in `prisma/schema.prisma`

Custom fields are stored as `String?` columns containing raw JSON. There is no schema validation on write, no indexing, and malformed JSON written to these fields will silently corrupt data. For PostgreSQL production, change these to the `Json` type. For SQLite development, add Zod validation at every write point.

---

### 19. No Authentication Event Audit Logging

The `AuditLog` model is well-designed and present in the schema, but login and logout events are not logged in the respective route handlers. For a UAE FTA-compliant platform, authentication events (successful logins, failed attempts, logouts, password changes) must be logged with IP address, user agent, and timestamp. Add audit log creation in `/api/auth/login` and `/api/auth/logout`.

---

### 20. JWT Has No Revocation Mechanism

**File:** `src/lib/auth.ts`

JWTs are valid for 7 days with no refresh token and no revocation list. If a tenant is suspended, their users' existing JWTs remain valid until expiry. The same applies if a user's account is deactivated. **Fix:** Check `user.isActive` and `tenant.status` on every authenticated request (via middleware), not just at login time.

---

## 🟡 Missing Features for UAE SaaS Production

### 21. No Email Verification on Registration

Users are registered and immediately logged in without email verification. This enables mass fake account creation and spam. Implement an email verification flow using a time-limited token (store in a `VerificationToken` model or use a service like Resend/SendGrid).

### 22. No Payment Gateway Integration

For a commercial SaaS selling in the UAE, payment collection is required. Recommended gateways:
- **Stripe** (international, supports UAE with Stripe Tax for VAT)
- **Telr** or **PayTabs** (UAE-local gateways, preferred by UAE businesses, support AED, card, and local payment methods)

### 23. No Actual FTA API Submission for E-Invoicing

The `generateEInvoiceUuid()` and e-invoice UUID storage are present, but there is no actual submission to the UAE Federal Tax Authority (FTA) portal API. For mandatory phase PINT AE e-invoicing compliance, each posted invoice must be cryptographically signed and submitted to the FTA clearance endpoint. This is a significant integration effort requiring:
- Cryptographic signing with a FTA-issued certificate
- XML generation per the PINT AE UBL 2.1 schema
- Submission to the FTA clearance API
- Storage of the FTA-returned clearance QR code on the invoice PDF

### 24. No Security Headers in `next.config.ts`

Production deployments need HTTP security headers. Add to `next.config.ts`:

```ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }]
}
```

### 25. No Automated Test Suite

There are no test files visible in the repository. For financial accounting software where calculation correctness carries legal weight, a test suite is non-negotiable. Recommended coverage:

- **Unit tests:** `vat-service.ts`, `journal-service.ts`, `decimal.ts` — all financial calculations
- **Integration tests:** Key API routes (`/api/invoices`, `/api/bills`, `/api/payments`, `/api/journal`)
- **Auth tests:** Login, register, permission checks, tenant isolation
- **Recommended tools:** Vitest (fast, TypeScript-native), `@prisma/client` test database

---

## ✅ What Is Done Well

The following aspects of the codebase reflect solid engineering decisions:

- **Double-entry validation** in `postJournalEntry` with `isBalanced()` enforces debits = credits at the service layer before writing to the database
- **`decimal.js`** is correctly chosen for all financial math to avoid floating-point errors (though partially undermined in `vat-service.ts` totals — see Bug #9)
- **Prisma parameterized queries** prevent SQL injection across all database operations
- **bcrypt with 10 rounds** for password hashing is industry standard and correct
- **HTTP-only JWT session cookie** with `sameSite: 'lax'` and `secure` in production provides solid baseline session security
- **Row-level tenant isolation** via `tenantId` on all business-scoped Prisma models is architecturally correct
- **`hasPermission('platform.admin')` checks on all admin API routes** consistently enforced
- **Zod validation on auth routes** (login, register) prevents malformed input
- **UAE VAT 5% compliance**: TRN validation, VAT return report, PINT AE UUID generation, FTA-format PDF templates
- **License key generation using `crypto.randomBytes`** is cryptographically secure
- **Journal reversal logic** for credit notes and voids correctly swaps debits/credits
- **`decimal.js` configuration** with `ROUND_HALF_UP` and precision 30 is appropriate for UAE financial reporting

---

## Prioritized Fix Roadmap

### Immediate (Before Any Production Deployment)

1. **Remove `.env` from repository** — purge from all git history, rotate any real credentials
2. **Crash on missing `JWT_SECRET` in production** — add startup validation
3. **Add `businessId` scoping to all `findUnique` calls** — invoices, bills, payments, parties, etc.
4. **Add auth check to `DELETE /api/invoices`** — prevent unauthenticated deletions
5. **Add rate limiting to `/api/auth/login`** — prevent brute-force attacks
6. **Make TENANT_COOKIE and BUSINESS_COOKIE `httpOnly`** — prevent XSS cookie theft

### Short-Term (Before First Customer)

7. **Fix VAT totals to use `decimal.js` throughout** `calculateDocumentTotals()`
8. **Replace `Math.random()` UUID with `crypto.randomUUID()`**
9. **Add `middleware.ts` for global route protection**
10. **Remove `ignoreBuildErrors: true` and `reactStrictMode: false`** from `next.config.ts`
11. **Fix journal numbering race condition** using atomic transactions
12. **Use `findMany` for journal reversal** when voiding invoices
13. **Add Zod validation to admin mutation routes**
14. **Add `httpOnly` and `secure` to all auth cookies**

### Medium-Term (Before Scale)

15. **Add security HTTP headers** to `next.config.ts`
16. **Implement email verification** on registration
17. **Add login/logout audit logging**
18. **Implement JWT revocation** or active session checks
19. **Switch `customFields` to `Json` type** on PostgreSQL
20. **Write unit tests** for all financial calculation functions
21. **Write integration tests** for core API routes

### Long-Term (For Commercial UAE SaaS)

22. **Integrate a UAE payment gateway** (Telr or PayTabs)
23. **Implement FTA API submission** for PINT AE e-invoicing clearance
24. **Add server-side PDF generation** (Puppeteer or WeasyPrint)
25. **Implement refresh token rotation** to replace 7-day static JWT

---

## Conclusion

AccountERP has a well-designed foundation with correct multi-tenant architecture, proper double-entry bookkeeping enforcement, and UAE VAT compliance structures in place. The technology choices are modern and appropriate for a SaaS product targeting the UAE market. However, several critical security vulnerabilities — particularly the exposed `.env` file, hardcoded JWT fallback, and missing tenant isolation on resource endpoints — must be resolved before any production deployment or customer onboarding. Addressing the full priority list above will produce a commercially viable, FTA-compliant, and security-hardened ERP platform.

---

*Report generated: July 12, 2026 | Repository: github.com/MuhammadRayyan/erp-zlm*
