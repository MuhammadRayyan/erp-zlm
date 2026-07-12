# AccountERP — In-Depth Code, Performance, UX & UI Improvement Review

**Repository:** [MuhammadRayyan/erp-zlm](https://github.com/MuhammadRayyan/erp-zlm)  
**Review date:** July 13, 2026  
**Scope:** Code quality, performance, UI/UX, usability, and next-stage product refinement

---

## Overview

The codebase has a strong security baseline following the completed audit rounds: strict TypeScript builds are enabled, API authentication and tenant isolation have been improved, and key document routes use business-scoped queries.

The highest-value next work is not more feature breadth. It is improving form-state reliability, removing broad `any` type escapes, adding consistent server-side validation, making document lists scale, and improving high-consequence accounting workflows.

The product should continue toward the established **Coffee Ledger** direction: warm light-mode-first surfaces, restrained rounded components, coffee-charcoal dark mode, a muted terracotta/amber accent, and minimal non-functional animation.

---

## Priority Improvements

| Priority | Area | Improvement | User / business impact |
|---|---|---|---|
| P0 | Form reliability | Prevent invoice edit form state from resetting during editing | Avoids lost user input and jittery forms |
| P0 | API resilience | Add Zod schemas to all financial-document create/update routes | Converts malformed request failures from 500 errors into helpful 400 errors |
| P1 | Type safety | Replace high-impact `any` casts with shared API/UI interfaces | Preserves strict TypeScript’s benefits and reduces regressions |
| P1 | Data performance | Add capped, cursor-based pagination and server-side filters | Keeps invoice/bill screens fast as data grows |
| P1 | Posting UX | Add a review-and-post confirmation flow | Prevents accidental accounting actions |
| P2 | Mobile UX | Replace horizontal line-item tables with stacked mobile cards | Makes document creation usable on phones |
| P2 | Compliance UX | Add per-rate VAT summary and missing-data warnings | Clearer UAE VAT workflows |
| P2 | Visual system | Apply Coffee Ledger tokens consistently | Makes the ERP feel branded rather than generic |

---

## Code Quality

### Prevent Invoice Form Resets

**File:** `src/components/erp/modules/invoices.tsx`

The edit form’s initialization effect both depends on `form` and calls `setForm`. Once an invoice is loaded, this can re-run and overwrite an in-progress edit. It also creates unnecessary renders.

### Recommended fix

Use a ref to ensure edit data initializes only once per document:

```tsx
const initialized = React.useRef(false)

React.useEffect(() => {
  if (!editId || !editInvoice || initialized.current) return

  initialized.current = true
  setForm({
    partyId: editInvoice.partyId,
    date: editInvoice.date.split('T')[0],
    dueDate: editInvoice.dueDate.split('T')[0],
    reference: editInvoice.reference || '',
    notes: editInvoice.notes || '',
    terms: editInvoice.terms || '',
    lines: editInvoice.lines.map(/* map safely */),
  })
}, [editId, editInvoice, business?.vatRegistered, business?.vatRate])
```

Reset `initialized.current` when `editId` changes so switching to a new document works correctly.

### Replace Broad `any` Types

Strict builds are active, but several components now use `any` as a workaround. Examples include component props and tax-rate access. This removes the compiler’s ability to protect financial forms from incorrect data shapes.

Prefer shared types:

```tsx
type Navigate = (
  module: string,
  params?: Record<string, string>
) => void

interface ApiInvoiceLine extends InvoiceLine {
  taxRate?: TaxRate | null
}

interface InvoiceListProps {
  navigate: Navigate
}
```

Then use safe access without casting:

```tsx
const rate = line.taxRate?.rate ?? 0
```

Create a shared `src/types/api.ts` for documents, line items, tax rates, parties, businesses, and paginated responses. This prevents copied, diverging local interfaces between screens.

### Add Zod Validation to Financial Documents

Document routes should not assume `body.lines` exists and is valid. For example, a malformed bills request can throw when calling `body.lines.map(...)`.

Create a reusable schema module:

```ts
import { z } from 'zod'

export const documentLineSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(100_000_000),
  discount: z.coerce.number().min(0).max(100),
  taxRateId: z.string().cuid().nullable().optional(),
})

export const billSchema = z.object({
  partyId: z.string().cuid(),
  date: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  supplierInvoiceNumber: z.string().trim().max(150).optional(),
  reference: z.string().trim().max(150).optional(),
  notes: z.string().trim().max(5_000).optional(),
  post: z.boolean().optional(),
  lines: z.array(documentLineSchema).min(1).max(500),
})
```

Use the same schemas for invoices, bills, quotations, credit notes, payments, and delivery notes. Return `400` with field-level errors that the frontend can display next to inputs.

---

## Performance and Scalability

### Cap Query Limits

The bills endpoint accepts a user-provided `limit` and passes it to Prisma. Clamp it to a safe range:

```ts
const requestedLimit = Number(searchParams.get('limit') ?? 50)
const limit = Math.min(Math.max(requestedLimit, 1), 100)
```

Do this on every list endpoint. Do not let a user request tens of thousands of rows in one API call.

### Use Cursor Pagination

Offset-style loading becomes slower as tables grow. Use cursor pagination with a stable order:

```ts
const cursor = searchParams.get('cursor')

const rows = await db.purchaseBill.findMany({
  where: { businessId },
  take: limit + 1,
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0,
  orderBy: [{ date: 'desc' }, { id: 'desc' }],
})

const hasMore = rows.length > limit
const items = hasMore ? rows.slice(0, -1) : rows
const nextCursor = hasMore ? items.at(-1)?.id : null
```

Return `{ items, nextCursor }`. The UI can provide **Load more** initially, then evolve to virtualized tables if usage warrants it.

### Move Filters to the Server

The invoice list currently retrieves rows and filters them in the browser. This is fine for small datasets, but it will slow down as users create more documents.

Support API filters:

```http
GET /api/invoices?search=acme&status=POSTED&cursor=...
```

Search invoice number and customer name server-side. Use `debounce` of 250–350 ms for the search box, and cancel stale requests with `AbortController`.

### Add Query-Aligned Indexes

During the PostgreSQL migration, add indexes that match how users browse accounting data:

```prisma
@@index([businessId, status, date])
@@index([businessId, partyId, date])
@@index([businessId, number])
```

Review slow query logs before adding more indexes. Every index speeds reads but adds cost to writes.

### Memoize Derived Form Totals

Line totals, subtotal, VAT, and grand total are recalculated on every render. Memoization is useful once documents have many lines:

```tsx
const calculated = React.useMemo(() => {
  const lines = form.lines.map(calculateLine)
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
  const totalTax = lines.reduce((sum, line) => sum + line.lineTax, 0)

  return { lines, subtotal, totalTax, total: subtotal + totalTax }
}, [form.lines, taxRates, vatRate])
```

Keep final calculations on the server as the authoritative source; client totals are only a preview.

---

## UX Improvements

### Safer Posting Workflow

Posting an invoice or bill changes accounting records and may create journal entries. A primary action called **Save & Post** can be too easy to trigger.

Recommended pattern:

1. Keep **Save draft** as a secondary action.
2. Rename the primary button to **Review & post**.
3. Display a confirmation sheet/modal with customer/supplier, document date, subtotal, VAT, total, and affected accounts.
4. Require confirmation: **Post invoice** or **Post bill**.
5. Disable posting when the document is incomplete, invalid, or has no lines.
6. Show a success message with links to **View journal entry** and **Record payment**.

This adds deliberate control without making normal drafting slower.

### Preserve Unsaved Changes

Add a dirty-state indicator and navigation protection:

- Display “Unsaved changes” beside the page title.
- Warn before module navigation, browser refresh, or closing the tab.
- Avoid warning after a successful save.
- If autosave is added later, show “Saved just now” with a subtle status icon.

### Explain Errors Near Fields

Do not rely only on toast messages. When server-side Zod validation returns errors, attach messages directly to the relevant field:

- “Select a customer before saving.”
- “Quantity must be greater than zero.”
- “Discount cannot exceed 100%.”
- “TRN must contain 15 digits for a VAT-registered business.”

Keep a summary at the top only when multiple fields need attention.

### Improve Empty States

Every empty module should tell the user what belongs there and provide the next action:

- **Invoices:** “No invoices yet. Create your first sale or import customers.”
- **Bills:** “Track supplier bills to see what you owe and when it is due.”
- **Items:** “Add items to speed up invoices and keep stock accurate.”

Pair it with one primary action and one optional secondary learning/import action.

---

## UAE VAT and Compliance UX

### Show VAT by Rate

A document can contain 5%, zero-rated, exempt, or mixed-rate lines. A single VAT card may imply one document-wide rate.

Add a compact VAT breakdown in the totals panel:

| VAT treatment | Taxable amount | VAT |
|---|---:|---:|
| Standard-rated (5%) | AED 1,000.00 | AED 50.00 |
| Zero-rated (0%) | AED 250.00 | AED 0.00 |
| **Total** | **AED 1,250.00** | **AED 50.00** |

Use the document’s actual selected rates. Do not hardcode 5% in summary labels.

### Compliance Checks Before Posting

For VAT-registered businesses, show non-blocking warnings before posting where appropriate:

- Seller TRN missing or invalid length
- Customer TRN missing for a tax invoice when required by the business’s policy
- Invoice date absent or outside an open fiscal period
- Mixed tax rates with no clear tax category labels
- Currency conversion required but exchange rate missing

Warnings should explain the impact and link users directly to the setting or field that resolves them.

---

## UI Direction — Coffee Ledger

The visual system should be refined around a warm, ownable accounting brand—not a generic high-gloss SaaS dashboard.

| UI area | Direction |
|---|---|
| Light background | Warm off-white / porcelain, rather than cold blue-gray |
| Main surface | Clean white cards with a subtle warm border |
| Dark background | Coffee-charcoal / deep warm gray, never dark blue |
| Accent | Muted terracotta or amber for primary actions and key highlights |
| Status colors | Use accessible muted tones plus explicit text labels; never color alone |
| Radius | Slightly rounded cards/inputs; tighter radius for dense tables |
| Shadows | Soft, warm, low-opacity elevation only for floating layers |
| Motion | 150–200 ms functional transitions; no decorative animations |
| Typography | Clear sans-serif body UI with strong numeric alignment and tabular figures |

### Tables

Accounting users live in tables. Improve them before adding decorative dashboards:

- Sticky table headers in long lists
- Right-aligned amounts with `font-variant-numeric: tabular-nums`
- Consistent decimal places and currency formatting
- Row hover state that does not look clickable unless it is clickable
- Clear status badges with icon/text, not color alone
- Quick actions on row hover: View, Edit Draft, Duplicate, Print, Record Payment
- Saved filters: Draft, Overdue, Due This Week, Unpaid
- Column chooser for power users, after core table quality is complete

### Mobile Line Items

Horizontal tables are difficult for document entry on narrow screens. At mobile widths, render each line as a card:

- Description and inventory picker first
- Quantity and unit price in a two-column grid
- Discount and VAT selector below
- Calculated amount pinned to the card footer
- Separate visible remove action
- Sticky mobile footer with document total and **Review & post**

This preserves desktop density while making mobile data entry practical.

---

## Reusable Document Form Pattern

Invoices, bills, quotations, credit notes, and delivery notes should share one internal architecture:

```text
DocumentForm
├── DocumentHeaderFields
├── PartySelector
├── DocumentDateFields
├── LineItemEditor
├── VatBreakdown
├── NotesAndTerms
├── DocumentTotals
├── DraftSaveAction
└── ReviewAndPostDialog
```

Build shared hooks for:

- Fetching parties, items, and tax rates
- Managing document line state
- Calculating client-side previews
- Mapping field errors from the API
- Dirty-state navigation protection
- Draft saving and posting confirmation

This reduces duplicated bugs and makes behavior consistent across sales and purchase modules.

---

## Recommended Delivery Sequence

### Phase 1 — Reliability (highest priority)

- Fix form initialization/reset behavior
- Add Zod validation to document APIs
- Display field-level validation errors
- Add posting confirmation and draft/post state protections
- Replace the highest-risk `any` casts with shared interfaces

### Phase 2 — Scale and speed

- Add capped limits and cursor pagination
- Move list search/filtering to the server
- Add query-aligned database indexes during PostgreSQL migration
- Memoize expensive client-side derived data
- Add request cancellation/debounced searching

### Phase 3 — UX polish

- Implement Coffee Ledger design tokens across screens
- Improve tables, empty states, filters, and quick actions
- Create mobile-friendly line-item cards
- Add VAT breakdown and pre-post compliance checks
- Standardize reusable document form architecture

---

## Success Criteria

The next improvement cycle is successful when:

- Editing a document never overwrites a user’s unsaved input.
- Invalid document input returns predictable 400 responses and field-level UI errors.
- A user can search/filter thousands of invoices or bills without loading all rows.
- Financial documents are deliberately reviewed before posting.
- Mobile document entry is practical without horizontal scrolling for every field.
- VAT information is clear for standard, zero-rated, exempt, and mixed invoices.
- All modules look and behave consistently within the warm Coffee Ledger visual system.
- Strict TypeScript remains meaningful because core interfaces do not rely on broad `any` escapes.
