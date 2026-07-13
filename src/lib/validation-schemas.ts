import { z } from 'zod'

// Reusable Zod schemas for all financial document routes
// These convert malformed requests into helpful 400 errors instead of 500 crashes

// ============================================================
// LINE ITEM SCHEMA (shared by invoices, bills, quotations, credit notes)
// ============================================================
export const documentLineSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  quantity: z.coerce.number().positive('Quantity must be positive').max(1_000_000),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative').max(100_000_000),
  discount: z.coerce.number().min(0, 'Discount cannot be negative').max(100, 'Discount cannot exceed 100%'),
  taxRateId: z.string().nullable().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  itemId: z.string().nullable().optional(),
})

// ============================================================
// INVOICE SCHEMA
// ============================================================
export const invoiceSchema = z.object({
  partyId: z.string().min(1, 'Customer is required'),
  date: z.string().min(1, 'Date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  reference: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  terms: z.string().trim().max(5000).optional().nullable(),
  post: z.boolean().optional(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required').max(500),
}).refine((data) => new Date(data.dueDate) >= new Date(data.date), { message: 'Due date must be on or after the invoice date', path: ['dueDate'] })

// ============================================================
// BILL SCHEMA
// ============================================================
export const billSchema = z.object({
  partyId: z.string().min(1, 'Supplier is required'),
  date: z.string().min(1, 'Date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  supplierInvoiceNumber: z.string().trim().max(150).optional().nullable(),
  reference: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  post: z.boolean().optional(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required').max(500),
}).refine((data) => new Date(data.dueDate) >= new Date(data.date), { message: 'Due date must be on or after the bill date', path: ['dueDate'] })

// ============================================================
// QUOTATION SCHEMA
// ============================================================
export const quotationSchema = z.object({
  partyId: z.string().min(1, 'Customer is required'),
  date: z.string().min(1, 'Date is required'),
  validUntil: z.string().optional().nullable(),
  reference: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  terms: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required').max(500),
})

// ============================================================
// CREDIT NOTE SCHEMA
// ============================================================
export const creditNoteSchema = z.object({
  partyId: z.string().min(1, 'Customer is required'),
  date: z.string().min(1, 'Date is required'),
  originalInvoiceId: z.string().optional().nullable(),
  reference: z.string().trim().max(150).optional().nullable(),
  reason: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  post: z.boolean().optional(),
  lines: z.array(documentLineSchema).min(1, 'At least one line item is required').max(500),
})

// ============================================================
// DELIVERY NOTE SCHEMA
// ============================================================
export const deliveryNoteLineSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  quantity: z.coerce.number().positive('Quantity must be positive').max(1_000_000),
  itemId: z.string().nullable().optional(),
})

export const deliveryNoteSchema = z.object({
  partyId: z.string().min(1, 'Customer is required'),
  date: z.string().min(1, 'Date is required'),
  invoiceId: z.string().optional().nullable(),
  reference: z.string().trim().max(150).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  lines: z.array(deliveryNoteLineSchema).min(1, 'At least one line item is required').max(500),
})

// ============================================================
// PAYMENT SCHEMA
// ============================================================
export const paymentSchema = z.object({
  type: z.enum(['RECEIPT', 'PAYMENT']),
  partyId: z.string().min(1, 'Party is required'),
  amount: z.coerce.number().positive('Amount must be positive').max(100_000_000),
  date: z.string().min(1, 'Date is required'),
  method: z.enum(['CASH', 'CHEQUE', 'BANK_TRANSFER', 'CARD', 'ONLINE', 'OTHER']).optional(),
  reference: z.string().trim().max(150).optional().nullable(),
  bankAccountId: z.string().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  allocations: z.array(z.object({
    invoiceId: z.string().optional().nullable(),
    billId: z.string().optional().nullable(),
    amount: z.coerce.number().min(0),
  })).optional(),
})

// ============================================================
// JOURNAL ENTRY SCHEMA
// ============================================================
export const journalLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
  description: z.string().trim().max(500).optional().nullable(),
  partyId: z.string().optional().nullable(),
})

export const journalEntrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reference: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines required').max(500),
})

// ============================================================
// HELPER: Safe parse with error formatting
// ============================================================
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): 
  { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  // Format errors as field → message map
  const errors: Record<string, string> = {}
  for (const err of result.error.issues) {
    const field = err.path.join('.')
    errors[field] = err.message
  }
  return { success: false, errors }
}
