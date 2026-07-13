# AccountERP (ERP-ZLM) — Commit d66852d Verification Report
## Fix Status & Remaining Issues
**Repository:** [https://github.com/MuhammadRayyan/erp-zlm](https://github.com/MuhammadRayyan/erp-zlm)
**Commit Verified:** [`d66852d`](https://github.com/MuhammadRayyan/erp-zlm/commit/d66852da86fb76d366c4d67f8cab6a735ccf0178)
**Review Date:** July 13, 2026
**Files Changed in Commit:** 30 files — 72 insertions, 1 deletion

---

## Executive Summary

Commit `d66852d` successfully implements Zod validation across 4 remaining financial document routes (quotations, credit notes, payments, delivery notes), adds compound database indexes on `SalesInvoice` and `PurchaseBill`, creates a shared `src/types/api.ts` types file, and applies limit clamping to remaining list endpoints.

However, **3 security bugs remain unresolved** — including the most critical tenant isolation bypass in the invoice actions route flagged in the previous report. Additionally, **3 new tenant isolation gaps** were identified in single-record GET fetches across quotations, credit notes, and delivery notes. These must be fixed before any live deployment.

---

## ✅ Confirmed — What Was Done Correctly

### Zod Validation — All 4 New Routes

**Quotations** (`src/app/api/quotations/route.ts`)
- Imports `quotationSchema, validateBody` from `@/lib/validation-schemas`
- `validateBody(quotationSchema, body)` called at the top of POST handler before any DB write
- Returns `{ error: 'Validation failed', fieldErrors: validation.errors }` with status 400 on failure
- ✅ **Verified correct**

**Credit Notes** (`src/app/api/credit-notes/route.ts`)
- Imports `creditNoteSchema, validateBody`
- Validation applied to POST handler before business lookup or DB write
- Also correctly posts a reversal journal entry (Sales Dr, Output VAT Dr, AR Cr)
- ✅ **Verified correct**

**Payments** (`src/app/api/payments/route.ts`)
- Imports `paymentSchema, validateBody`
- Validation applied at top of POST handler
- Limit clamp `Math.min(Math.max(parseInt(...), 1), 100)` confirmed on GET list endpoint
- ✅ **Verified correct**

**Delivery Notes** (`src/app/api/delivery-notes/route.ts`)
- Imports `deliveryNoteSchema, validateBody`
- Validation applied to POST handler
- ✅ **Verified correct**

---

### Compound Database Indexes — `prisma/schema.prisma`

The following new compound indexes were confirmed present in the updated schema:

**SalesInvoice model:**
```prisma
@@index([businessId, status, date])   // NEW — filter by status in date range
@@index([businessId, partyId, date])  // NEW — customer statement queries
@@index([businessId, number])         // NEW — document number lookups
@@index([businessId, date])           // existing
@@index([partyId])                    // existing
@@index([status])                     // existing
```

**PurchaseBill model:**
```prisma
@@index([businessId, status, date])   // NEW
@@index([businessId, partyId, date])  // NEW
@@index([businessId, number])         // NEW
@@index([businessId, date])           // existing
@@index([partyId])                    // existing
@@index([status])                     // existing
```

✅ **Verified correct** — these indexes will significantly speed up filtered list queries, aged receivables reports, and supplier statement views.

---

### Shared Types File — `src/types/api.ts`

File created with the following exported interfaces:
- `Navigate` — function type for module navigation
- `TaxRate` — `{ id, name, rate, category, isDefault? }`
- `Business` — full business profile shape with UAE fields (`trn`, `vatRate`, etc.)
- `PaginatedResponse<T>` — `{ items: T[], nextCursor: string | null, hasMore: boolean }`

✅ **Verified correct** — reduces type duplication across invoice, bill, and quotation form components.

---

## ❌ NOT Done — Remaining Open Issues

### 🔴 CRITICAL — Invoice Actions Tenant Isolation Bypass (STILL UNFIXED)

**File:** `src/app/api/invoices/actions/route.ts`
**SHA at time of review:** `9f646fcc` — **unchanged from previous review**

The file was **not modified** in commit `d66852d`. The critical bug remains: the invoice is fetched with `findUnique({ where: { id } })` with no `businessId` scoping. Any authenticated user who knows or guesses another tenant's invoice ID can post or void it.

**Current vulnerable code:**
```typescript
const invoice = await db.salesInvoice.findUnique({
  where: { id },
  include: { party: true, lines: true },
})
if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
```

**Required fix:**
```typescript
const businessId = await ensureBusinessId() // already called at top of function
const invoice = await db.salesInvoice.findFirst({
  where: { id, businessId },  // ADD businessId here
  include: { party: true, lines: true },
})
if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

> Note: `ensureBusinessId()` is already called at the top of this handler — the variable is available. This is literally a one-word change from `findUnique` to `findFirst` plus adding `businessId` to the where clause.

---

### 🟡 MEDIUM — Journal POST Missing Zod Validation (STILL UNFIXED)

**File:** `src/app/api/journal/route.ts`
**SHA at time of review:** `83e12469` — **unchanged from previous review**

The `journalEntrySchema` created in `src/lib/validation-schemas.ts` is still not applied to the manual journal entry POST route. The route only performs a balance check via `isBalanced(body.lines)`. A payload with a missing `date` field, null lines, or invalid types will cause a Prisma/runtime 500 error instead of a clean 400 response.

**Required fix — add before the balance check:**
```typescript
import { journalEntrySchema, validateBody } from '@/lib/validation-schemas'

export async function POST(req: NextRequest) {
  const businessId = await ensureBusinessId()
  const body = await req.json()

  // ADD THIS:
  const validation = validateBody(journalEntrySchema, body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: validation.errors },
      { status: 400 }
    )
  }

  // Existing check (keep):
  if (!isBalanced(body.lines)) {
    return NextResponse.json(
      { error: 'Journal entry not balanced (debits must equal credits)' },
      { status: 400 }
    )
  }
  // ... rest of handler unchanged
}
```

---

### 🔴 NEW — Quotation GET Single-Record Fetch Missing Tenant Scope

**File:** `src/app/api/quotations/route.ts`

The single-record GET fetch uses `findUnique({ where: { id } })` — no `businessId` filter. Any authenticated user can read another tenant's quotation by ID.

**Vulnerable code:**
```typescript
const q = await db.quotation.findUnique({
  where: { id },
  include: { party: true, lines: { ... } },
})
```

**Fix:**
```typescript
const q = await db.quotation.findFirst({
  where: { id, businessId },
  include: { party: true, lines: { ... } },
})
if (!q) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

---

### 🔴 NEW — Credit Note GET Single-Record Fetch Missing Tenant Scope

**File:** `src/app/api/credit-notes/route.ts`

Same pattern — `findUnique({ where: { id } })` on single-record GET with no `businessId`.

**Fix:**
```typescript
const cn = await db.creditNote.findFirst({
  where: { id, businessId },
  include: { party: true, lines: { ... } },
})
if (!cn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

---

### 🔴 NEW — Delivery Note GET Single-Record Fetch Missing Tenant Scope

**File:** `src/app/api/delivery-notes/route.ts`

Same pattern — `findUnique({ where: { id } })` on single-record GET with no `businessId`.

**Fix:**
```typescript
const dn = await db.deliveryNote.findFirst({
  where: { id, businessId },
  include: { party: true, lines: { ... } },
})
if (!dn) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

---

## Complete Verified Status Table

| Item Claimed | File | Verified | Notes |
|---|---|---|---|
| `quotationSchema` Zod on POST | `quotations/route.ts` | ✅ Done | Correct |
| `creditNoteSchema` Zod on POST | `credit-notes/route.ts` | ✅ Done | Correct |
| `paymentSchema` Zod on POST | `payments/route.ts` | ✅ Done | Correct |
| `deliveryNoteSchema` Zod on POST | `delivery-notes/route.ts` | ✅ Done | Correct |
| Compound indexes on invoices | `prisma/schema.prisma` | ✅ Done | 3 new indexes |
| Compound indexes on bills | `prisma/schema.prisma` | ✅ Done | 3 new indexes |
| `src/types/api.ts` created | `src/types/api.ts` | ✅ Done | Correct |
| Limit clamp on payments GET | `payments/route.ts` | ✅ Done | Correct |
| Invoice actions tenant isolation fix | `invoices/actions/route.ts` | ❌ NOT DONE | Critical — still `findUnique` no `businessId` |
| Journal POST Zod validation | `journal/route.ts` | ❌ NOT DONE | `journalEntrySchema` not applied |
| Quotation GET scoping | `quotations/route.ts` | ❌ NEW BUG | `findUnique` without `businessId` |
| Credit note GET scoping | `credit-notes/route.ts` | ❌ NEW BUG | `findUnique` without `businessId` |
| Delivery note GET scoping | `delivery-notes/route.ts` | ❌ NEW BUG | `findUnique` without `businessId` |

---

## Next Commit — Exact Files to Change

All remaining fixes are small, surgical changes. Estimated total effort: **30 minutes**.

| # | File | Change |
|---|---|---|
| 1 | `src/app/api/invoices/actions/route.ts` | `findUnique → findFirst` + add `businessId` to where |
| 2 | `src/app/api/quotations/route.ts` | `findUnique → findFirst` + add `businessId` to where |
| 3 | `src/app/api/credit-notes/route.ts` | `findUnique → findFirst` + add `businessId` to where |
| 4 | `src/app/api/delivery-notes/route.ts` | `findUnique → findFirst` + add `businessId` to where |
| 5 | `src/app/api/journal/route.ts` | Add `validateBody(journalEntrySchema, body)` import + check |

### Recommended audit of remaining routes

After applying the above, do a codebase-wide search for the pattern `findUnique({ where: { id }` and verify every result either:
- (a) also includes `businessId` in the where clause, OR
- (b) is on a platform-level model (User, Tenant, Plan) where tenant scoping does not apply

```bash
# Run this to find all potentially unscoped findUnique calls:
grep -rn "findUnique({ where: { id" src/app/api/
```

Any result that does NOT also have `businessId` in the same where object should be changed to `findFirst` with `businessId` added.

---

## Still Deferred — Phase 3 (No Change)

These items remain correctly deferred as UI/visual polish with no security impact:

- Coffee Ledger design tokens (warm color palette)
- Mobile-friendly line-item cards
- Sticky table headers with `tabular-nums`
- VAT breakdown table in totals panel
- Reusable/shared document form architecture (DRY)
- Pre-post compliance checks (TRN validation warnings)

---

*Report generated by Perplexity AI — July 13, 2026*
*Based on direct source code inspection of commit `d66852d` in repository `MuhammadRayyan/erp-zlm`*
