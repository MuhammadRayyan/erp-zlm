// Account types
export const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
] as const

export const ACCOUNT_SUBTYPES: Record<string, string[]> = {
  ASSET: ['CURRENT_ASSET', 'FIXED_ASSET', 'INVENTORY', 'BANK', 'CASH', 'ACCOUNTS_RECEIVABLE', 'OTHER_ASSET'],
  LIABILITY: ['CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'ACCOUNTS_PAYABLE', 'OTHER_LIABILITY'],
  EQUITY: ['CAPITAL', 'RETAINED_EARNINGS', 'DRAWINGS', 'OTHER_EQUITY'],
  INCOME: ['OPERATING_INCOME', 'OTHER_INCOME', 'SALES', 'SERVICE_INCOME'],
  EXPENSE: ['OPERATING_EXPENSE', 'COST_OF_GOODS_SOLD', 'ADMINISTRATIVE', 'SALARIES', 'RENT', 'UTILITIES', 'MARKETING', 'OTHER_EXPENSE'],
}

// Document statuses
export const INVOICE_STATUS = ['DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOID'] as const
export const BILL_STATUS = ['DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOID'] as const
export const QUOTATION_STATUS = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'] as const
export const PAYMENT_TYPE = ['RECEIPT', 'PAYMENT'] as const
export const PAYMENT_METHOD = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'CARD', 'ONLINE', 'OTHER'] as const

// VAT categories (UAE)
export const VAT_CATEGORIES = [
  { value: 'STANDARD_RATED', label: 'Standard Rated (5%)', rate: 5 },
  { value: 'ZERO_RATED', label: 'Zero Rated (0%)', rate: 0 },
  { value: 'EXEMPT', label: 'Exempt', rate: 0 },
  { value: 'OUT_OF_SCOPE', label: 'Out of Scope', rate: 0 },
] as const

// Doctypes for custom fields and PDF templates
export const DOCTYPES = [
  { value: 'SALES_INVOICE', label: 'Sales Invoice' },
  { value: 'PURCHASE_BILL', label: 'Purchase Bill' },
  { value: 'QUOTATION', label: 'Quotation' },
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
  { value: 'DELIVERY_NOTE', label: 'Delivery Note' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'PARTY', label: 'Customer / Supplier' },
  { value: 'ITEM', label: 'Inventory Item' },
  { value: 'JOURNAL_ENTRY', label: 'Journal Entry' },
] as const

// Custom field types
export const CUSTOM_FIELD_TYPES = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number (Integer)' },
  { value: 'DECIMAL', label: 'Decimal' },
  { value: 'DATE', label: 'Date' },
  { value: 'SELECT', label: 'Select (Dropdown)' },
  { value: 'CHECKBOX', label: 'Checkbox' },
  { value: 'TEXTAREA', label: 'Long Text' },
  { value: 'LINK', label: 'Link to Record' },
] as const

// UAE Emirates
export const UAE_EMIRATES = [
  'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'
] as const

// UAE-standard chart of accounts template
export const UAE_CHART_OF_ACCOUNTS = [
  // ASSETS
  { code: '1000', name: 'Current Assets', type: 'ASSET', subtype: 'CURRENT_ASSET', isHeader: true },
  { code: '1010', name: 'Cash on Hand', type: 'ASSET', subtype: 'CASH', parent: '1000' },
  { code: '1020', name: 'Bank - Current Account', type: 'ASSET', subtype: 'BANK', parent: '1000' },
  { code: '1021', name: 'Bank - Savings Account', type: 'ASSET', subtype: 'BANK', parent: '1000' },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', subtype: 'ACCOUNTS_RECEIVABLE', parent: '1000', isControl: true },
  { code: '1200', name: 'Inventory', type: 'ASSET', subtype: 'INVENTORY', parent: '1000' },
  { code: '1300', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1000' },
  { code: '1500', name: 'Advance to Suppliers', type: 'ASSET', subtype: 'CURRENT_ASSET', parent: '1000' },
  { code: '1600', name: 'Fixed Assets', type: 'ASSET', subtype: 'FIXED_ASSET', isHeader: true },
  { code: '1610', name: 'Office Equipment', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1600' },
  { code: '1620', name: 'Furniture & Fixtures', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1600' },
  { code: '1630', name: 'Vehicles', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1600' },
  { code: '1640', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'FIXED_ASSET', parent: '1600' },
  // LIABILITIES
  { code: '2000', name: 'Current Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', isHeader: true },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'ACCOUNTS_PAYABLE', parent: '2000', isControl: true },
  { code: '2200', name: 'VAT Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000' },
  { code: '2210', name: 'Input VAT', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000' },
  { code: '2220', name: 'Output VAT', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000' },
  { code: '2300', name: 'Accrued Expenses', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000' },
  { code: '2400', name: 'Customer Advances', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000' },
  { code: '2500', name: 'Salaries Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', parent: '2000' },
  { code: '2600', name: 'Long-term Liabilities', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', isHeader: true },
  { code: '2610', name: 'Bank Loan', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', parent: '2600' },
  // EQUITY
  { code: '3000', name: 'Equity', type: 'EQUITY', subtype: 'CAPITAL', isHeader: true },
  { code: '3100', name: 'Owner Capital', type: 'EQUITY', subtype: 'CAPITAL', parent: '3000' },
  { code: '3200', name: 'Retained Earnings', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', parent: '3000' },
  { code: '3300', name: 'Owner Drawings', type: 'EQUITY', subtype: 'DRAWINGS', parent: '3000' },
  // INCOME
  { code: '4000', name: 'Revenue', type: 'INCOME', subtype: 'OPERATING_INCOME', isHeader: true },
  { code: '4100', name: 'Sales Income', type: 'INCOME', subtype: 'SALES', parent: '4000' },
  { code: '4200', name: 'Service Income', type: 'INCOME', subtype: 'SERVICE_INCOME', parent: '4000' },
  { code: '4300', name: 'Other Income', type: 'INCOME', subtype: 'OTHER_INCOME', parent: '4000' },
  { code: '4400', name: 'Discount Given', type: 'INCOME', subtype: 'OPERATING_INCOME', parent: '4000' },
  // EXPENSES
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', subtype: 'COST_OF_GOODS_SOLD', isHeader: true },
  { code: '5100', name: 'Purchases', type: 'EXPENSE', subtype: 'COST_OF_GOODS_SOLD', parent: '5000' },
  { code: '5200', name: 'Freight & Shipping', type: 'EXPENSE', subtype: 'COST_OF_GOODS_SOLD', parent: '5000' },
  { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', isHeader: true },
  { code: '6100', name: 'Salaries & Wages', type: 'EXPENSE', subtype: 'SALARIES', parent: '6000' },
  { code: '6200', name: 'Rent Expense', type: 'EXPENSE', subtype: 'RENT', parent: '6000' },
  { code: '6300', name: 'Utilities', type: 'EXPENSE', subtype: 'UTILITIES', parent: '6000' },
  { code: '6400', name: 'Office Supplies', type: 'EXPENSE', subtype: 'ADMINISTRATIVE', parent: '6000' },
  { code: '6500', name: 'Marketing & Advertising', type: 'EXPENSE', subtype: 'MARKETING', parent: '6000' },
  { code: '6600', name: 'Telephone & Internet', type: 'EXPENSE', subtype: 'ADMINISTRATIVE', parent: '6000' },
  { code: '6700', name: 'Insurance', type: 'EXPENSE', subtype: 'ADMINISTRATIVE', parent: '6000' },
  { code: '6800', name: 'Bank Charges', type: 'EXPENSE', subtype: 'ADMINISTRATIVE', parent: '6000' },
  { code: '6900', name: 'Depreciation Expense', type: 'EXPENSE', subtype: 'ADMINISTRATIVE', parent: '6000' },
  { code: '6950', name: 'Discount Received', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE', parent: '6000' },
] as const

export type UAEAccountTemplate = typeof UAE_CHART_OF_ACCOUNTS[number]
