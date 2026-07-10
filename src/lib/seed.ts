import { db } from './db'
import { UAE_CHART_OF_ACCOUNTS } from './constants'

// Seed a default business with UAE chart of accounts, tax rates, and currencies
export async function seedDefaultData() {
  // Check if any business exists
  const existing = await db.business.findFirst()
  if (existing) {
    // Ensure it has chart of accounts
    const accountCount = await db.account.count({ where: { businessId: existing.id } })
    if (accountCount > 0) return existing
    await seedChartOfAccounts(existing.id)
    await seedTaxRates(existing.id)
    await seedCurrencies(existing.id)
    return existing
  }

  // Create default business
  const business = await db.business.create({
    data: {
      name: 'My Company',
      legalName: 'My Company LLC',
      trn: '',
      baseCurrency: 'AED',
      vatRegistered: true,
      vatRate: 5.0,
    },
  })

  await seedChartOfAccounts(business.id)
  await seedTaxRates(business.id)
  await seedCurrencies(business.id)

  // Create default PDF templates
  await seedDefaultTemplates(business.id)

  return business
}

export async function seedChartOfAccounts(businessId: string) {
  const existing = await db.account.count({ where: { businessId } })
  if (existing > 0) return

  const codeToId: Record<string, string> = {}

  for (const acc of UAE_CHART_OF_ACCOUNTS) {
    const parentId = acc.parent ? codeToId[acc.parent] : null
    const account = await db.account.create({
      data: {
        businessId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype,
        parentId,
        isControl: (acc as { isControl?: boolean }).isControl || false,
        isSystem: true,
        isActive: true,
        openingBalance: 0,
      },
    })
    codeToId[acc.code] = account.id
  }
}

export async function seedTaxRates(businessId: string) {
  const existing = await db.taxRate.count({ where: { businessId } })
  if (existing > 0) return

  await db.taxRate.createMany({
    data: [
      { businessId, name: 'VAT 5%', nameAr: 'ضريبة القيمة المضافة ٥٪', rate: 5.0, category: 'STANDARD_RATED', isDefault: true },
      { businessId, name: 'Zero Rated', nameAr: 'صفرية', rate: 0.0, category: 'ZERO_RATED' },
      { businessId, name: 'Exempt', nameAr: 'معفاة', rate: 0.0, category: 'EXEMPT' },
      { businessId, name: 'Out of Scope', nameAr: 'خارج النطاق', rate: 0.0, category: 'OUT_OF_SCOPE' },
    ],
  })
}

export async function seedCurrencies(businessId: string) {
  const existing = await db.currency.count({ where: { businessId } })
  if (existing > 0) return

  await db.currency.createMany({
    data: [
      { businessId, code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', isBase: true, exchangeRate: 1 },
      { businessId, code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 0.272 },
      { businessId, code: 'EUR', name: 'Euro', symbol: '€', exchangeRate: 0.252 },
      { businessId, code: 'GBP', name: 'British Pound', symbol: '£', exchangeRate: 0.216 },
      { businessId, code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', exchangeRate: 1.021 },
      { businessId, code: 'INR', name: 'Indian Rupee', symbol: '₹', exchangeRate: 22.74 },
      { businessId, code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', exchangeRate: 75.68 },
    ],
  })
}

export async function seedDefaultTemplates(businessId: string) {
  const existing = await db.pdfTemplate.count({ where: { businessId } })
  if (existing > 0) return

  const { DEFAULT_INVOICE_TEMPLATE, DEFAULT_TEMPLATE_CSS } = await import('./default-templates')

  const templates = [
    { doctype: 'SALES_INVOICE', name: 'Default Invoice' },
    { doctype: 'PURCHASE_BILL', name: 'Default Bill' },
    { doctype: 'QUOTATION', name: 'Default Quotation' },
    { doctype: 'CREDIT_NOTE', name: 'Default Credit Note' },
    { doctype: 'DELIVERY_NOTE', name: 'Default Delivery Note' },
  ]

  for (const t of templates) {
    await db.pdfTemplate.create({
      data: {
        businessId,
        name: t.name,
        doctype: t.doctype,
        htmlContent: DEFAULT_INVOICE_TEMPLATE,
        cssContent: DEFAULT_TEMPLATE_CSS,
        isDefault: true,
        isSystem: true,
      },
    })
  }
}
