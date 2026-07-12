# AccountERP — Re-Verification Report (Post-Fix Audit)

**Repository:** [MuhammadRayyan/erp-zlm](https://github.com/MuhammadRayyan/erp-zlm)  
**Commit Verified:** [`ad9a7d1`](https://github.com/MuhammadRayyan/erp-zlm/commit/ad9a7d1491438ac1e1b30c8e11c4fc5bf0285b24)  
**Audit Date:** July 12, 2026  
**Changes in Commit:** +1,099 / −205 lines across 25 files

---

## Executive Summary

The security commit addressed the majority of critical issues from the original audit. Out of 25 issues originally reported, **13 are fully resolved**, **1 is partially fixed** (IDOR on invoice GET), and **4 new issues were introduced** in this commit that require immediate attention — most critically, the new `middleware.ts` performs only a structural JWT check and does not verify the token's cryptographic signature, providing false protection.

---

## ✅ Issues Fully Fixed (13/25)

| # | Original Issue | Fix Verified |
|---|---|---|
| 1 | `.env` committed to public repo | ✅ File deleted in this commit |
| 2 | Hardcoded fallback JWT secret | ✅ `throw new Error('FATAL: JWT_SECRET...')` in production |
| 4 | No auth check on `DELETE /api/invoices` | ✅ `ensureBusinessId()` + `AuthError` handling added |
| 5 | No rate limiting on login | ✅ `checkLoginRateLimit(ip)` — 10 attempts/15 min in prod |
| 6 | TENANT/BUSINESS cookies not `httpOnly` | ✅ Both cookies now have `httpOnly`, `secure`, `sameSite: 'lax'` |
| 7 | No global route protection middleware | ✅ `middleware.ts` added, covers all `/api/*` routes |
| 9 | VAT totals using native floating-point `+` | ✅ All summations now use `decimal.js` `.plus()` |
| 10 | `Math.random()` UUID generation | ✅ Replaced with `randomUUID()` from `crypto` module |
| 12 | `reactStrictMode: false` | ✅ Now `reactStrictMode: true` |
| 13 | Invoice voiding only reverses first journal entry | ✅ Commit confirms `findMany` applied |
| 14 | Password minimum 6 characters | ✅ Strengthened to minimum 8 characters |
| 25 | No HTTP security headers | ✅ All 6 headers added: HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy |
| — | Rate limiting also added to `/api/auth/register` | ✅ `checkRegisterRateLimit` — 5 attempts/hour in prod |

---

## ⚠️ Partially Fixed

### Issue #3 — IDOR on Invoice `GET` by ID Still Not Fixed

**File:** `src/app/api/invoices/route.ts` — `GET` handler

The `PUT` and `DELETE` handlers were correctly fixed with `findFirst({ where: { id, businessId } })`, but the `GET` handler for a single invoice still uses `findUnique` without scoping to `businessId`:

```ts
// ❌ Still vulnerable — no businessId scope
const invoice = await db.salesInvoice.findUnique({
  where: { id },
  include: { ... },
})
```

A user from Tenant A who knows or guesses the CUID of an invoice from Tenant B can still read its full contents including party name, line items, totals, and notes. **Fix:**

```ts
// ✅ Correct fix
const invoice = await db.salesInvoice.findFirst({
  where: { id, businessId },
  include: {
    party: true,
    lines: { include: { taxRate: true }, orderBy: { position: 'asc' } },
  },
})
if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

---

## 🔴 New Issues Introduced in This Commit

### New Issue A — Middleware Does NOT Verify JWT Signature (Critical)

**File:** `src/middleware.ts`

The new middleware checks only that the cookie value contains 3 dot-separated segments — it does **not** verify the cryptographic signature:

```ts
// ❌ This is NOT signature verification — any forged JWT passes
const parts = sessionCookie.split('.')
if (parts.length !== 3) {
  return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
}
```

A self-crafted JWT with any payload and a fake signature (3 valid base64 segments) will pass this check and reach every route handler. The comment in the file itself acknowledges this: `// We just check the token exists and is well-formed here`. This means the middleware provides **false confidence** — it looks like protection but isn't.

The standard `jsonwebtoken` library cannot run in Next.js Edge Runtime. **Two correct solutions:**

**Option A — Switch middleware to Node.js runtime (Recommended):**
```ts
export const runtime = 'nodejs'
import jwt from 'jsonwebtoken'

// In middleware:
try {
  jwt.verify(sessionCookie, process.env.JWT_SECRET || 'dev-only-secret-not-for-production')
} catch {
  return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
}
```

**Option B — Use `jose` library (Edge-compatible):**
```ts
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-only-secret-not-for-production')
try {
  await jwtVerify(sessionCookie, secret)
} catch {
  return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
}
```

---

### New Issue B — `Math.random()` Fallback Still Present in `generateEInvoiceUuid`

**File:** `src/lib/vat-service.ts`

The `crypto.randomUUID()` fix is wrapped in a try/catch that falls back to `Math.random()`:

```ts
try {
  return randomUUID()
} catch {
  // Fallback for environments without crypto module
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0  // ❌ Insecure fallback still exists
    ...
  })
}
```

`crypto.randomUUID()` is available in all Node.js 16+ environments and will never throw in a normal Next.js/Docker deployment. This fallback will never be legitimately needed, yet its existence means the insecure path can still execute in unexpected edge cases. **Fix — remove the fallback entirely:**

```ts
export function generateEInvoiceUuid(): string {
  return randomUUID()
}
```

---

### New Issue C — Rate Limiter is In-Memory Only (Not Production-Safe for Multi-Instance Deployments)

**File:** `src/lib/rate-limit.ts`

The rate limiter stores state in a `Map<string, Bucket>` in Node.js process memory. In any horizontally-scaled deployment (Docker with replicas, Railway, Vercel serverless functions), each instance maintains its own memory independently. An attacker can bypass the limit by distributing requests across instances — getting 10 attempts per instance × N instances.

**For single-instance Docker deployments (your current setup), this is acceptable.** However, add a warning comment in the file and README so the limitation is explicit:

```ts
// ⚠️ WARNING: This rate limiter is in-memory and NOT safe for multi-instance deployments.
// For horizontal scaling (multiple replicas), replace with a Redis-backed limiter:
// https://github.com/upstash/ratelimit
```

For future multi-instance production, replace with `@upstash/ratelimit` (Upstash has a free tier and works with Redis on any deployment platform).

---

### New Issue D — `db/custom.db` SQLite Database File Still Committed

**Commit diff:** `db/custom.db` was **modified** (not removed) in this commit

A binary SQLite database file should never be in a git repository. It contains real seeded data including the test admin credentials (`admin@accounterp.com / Admin@123456`). Anyone who clones the repo has a copy of this database with all its data.

**Fix:**

```bash
# Remove from git tracking
git rm --cached db/custom.db db/custom.db-shm db/custom.db-wal 2>/dev/null || true

# Add to .gitignore
echo "db/*.db" >> .gitignore
echo "db/*.db-shm" >> .gitignore
echo "db/*.db-wal" >> .gitignore

git commit -m "Remove SQLite DB from tracking"
```

---

## 🟡 Remaining Open Issues (Not Yet Addressed)

These are from the original audit and were not part of this commit's scope.

| # | Issue | Priority |
|---|---|---|
| 8 | Journal entry number race condition (`count + 1` is not atomic) | High |
| 11 | `typescript: ignoreBuildErrors: true` still on | Medium (55 pre-existing TS errors — resolve over time) |
| 15 | No Zod validation on admin mutation routes (`/api/admin/tenants`, `/api/admin/licenses` POST) | Medium |
| 16 | Handlebars `{{{ }}}` triple-brace XSS risk in PDF templates | Medium |
| 17 | `provider = "sqlite"` hardcoded in Prisma schema | Medium |
| 18 | `customFields` stored as raw JSON strings | Low |
| 19 | No login/logout audit log entries | Medium |
| 20 | JWT 7-day sessions with no revocation mechanism | Medium |
| 21 | No email verification on registration | Medium |
| 22 | No payment gateway integration | Roadmap |
| 23 | No FTA API submission for PINT AE e-invoicing clearance | Roadmap |
| 24 | No refresh token mechanism | Low |

---

## Immediate Action Items

Listed in order of urgency:

1. **Fix middleware JWT verification** — add `export const runtime = 'nodejs'` and call `jwt.verify()`, or install `jose` for Edge-compatible verification. This is the only remaining critical security issue.
2. **Fix IDOR on `GET /api/invoices?id=`** — change `findUnique({ where: { id } })` to `findFirst({ where: { id, businessId } })`.
3. **Remove `db/custom.db` from git** — add to `.gitignore` and purge from tracking.
4. **Remove `Math.random()` fallback** in `generateEInvoiceUuid()`.
5. **Document rate limiter limitation** — add comment warning about in-memory state and single-instance requirement.

---

## Fix Progress Tracker

| Category | Fixed | Partial | Open | Total |
|---|---|---|---|---|
| Critical Security | 6 | 1 | 1 (middleware JWT) | 8 |
| Bugs & Logic | 5 | 0 | 2 (race condition, TS errors) | 7 |
| Architecture | 0 | 0 | 5 | 5 |
| Missing Features | 0 | 0 | 5 | 5 |
| **Total** | **13** | **1** | **11** | **25** |

---

*Report generated: July 12, 2026 | Verified commit: ad9a7d1 | Repository: github.com/MuhammadRayyan/erp-zlm*
