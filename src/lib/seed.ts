import { db } from './db'
import { UAE_CHART_OF_ACCOUNTS } from './constants'
import * as Tpl from './default-templates'

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
      tenantId: 'default',
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

  for (const acc of UAE_CHART_OF_ACCOUNTS as any) {
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
  // Professional template catalog. The first template of each doctype is
  // flagged as the default. All are flagged as system (non-deletable).
  const templates = [
    // === SALES_INVOICE — five distinct designs; "Modern Invoice" is default ===
    {
      name: 'Modern Invoice',
      doctype: 'SALES_INVOICE',
      htmlContent: Tpl.DEFAULT_INVOICE_TEMPLATE,
      cssContent: Tpl.DEFAULT_TEMPLATE_CSS,
      isDefault: true,
    },
    {
      name: 'Classic Invoice',
      doctype: 'SALES_INVOICE',
      htmlContent: Tpl.CLASSIC_INVOICE_TEMPLATE,
      cssContent: Tpl.CLASSIC_INVOICE_CSS,
      isDefault: false,
    },
    {
      name: 'UAE Compliant Invoice',
      doctype: 'SALES_INVOICE',
      htmlContent: Tpl.UAE_COMPLIANT_INVOICE_TEMPLATE,
      cssContent: Tpl.UAE_COMPLIANT_INVOICE_CSS,
      isDefault: false,
    },
    {
      name: 'Minimal Invoice',
      doctype: 'SALES_INVOICE',
      htmlContent: Tpl.MINIMAL_INVOICE_TEMPLATE,
      cssContent: Tpl.MINIMAL_INVOICE_CSS,
      isDefault: false,
    },
    {
      name: 'Bold Invoice',
      doctype: 'SALES_INVOICE',
      htmlContent: Tpl.BOLD_INVOICE_TEMPLATE,
      cssContent: Tpl.BOLD_INVOICE_CSS,
      isDefault: false,
    },
    // === PURCHASE_BILL ===
    {
      name: 'Modern Bill',
      doctype: 'PURCHASE_BILL',
      htmlContent: Tpl.DEFAULT_INVOICE_TEMPLATE,
      cssContent: Tpl.DEFAULT_TEMPLATE_CSS,
      isDefault: true,
    },
    // === QUOTATION ===
    {
      name: 'Professional Quotation',
      doctype: 'QUOTATION',
      htmlContent: Tpl.PRO_QUOTATION_TEMPLATE,
      cssContent: Tpl.PRO_QUOTATION_CSS,
      isDefault: true,
    },
    // === CREDIT_NOTE ===
    {
      name: 'Professional Credit Note',
      doctype: 'CREDIT_NOTE',
      htmlContent: Tpl.PRO_CREDIT_NOTE_TEMPLATE,
      cssContent: Tpl.PRO_CREDIT_NOTE_CSS,
      isDefault: true,
    },
    // === DELIVERY_NOTE ===
    {
      name: 'Professional Delivery Note',
      doctype: 'DELIVERY_NOTE',
      htmlContent: Tpl.PRO_DELIVERY_NOTE_TEMPLATE,
      cssContent: Tpl.PRO_DELIVERY_NOTE_CSS,
      isDefault: true,
    },
  ]

  // Use upsert with an empty `update` so seeding is idempotent:
  //   - New businesses get all templates created
  //   - Existing businesses keep their (possibly customized) templates untouched
  //   - New templates added in upgrades get created alongside existing ones
  for (const t of templates) {
    // If another template for this doctype is already marked default, don't
    // introduce a second default (the API enforces single-default-per-doctype
    // on user edits; we mirror that here).
    let isDefault = t.isDefault
    if (isDefault) {
      const existingDefault = await db.pdfTemplate.findFirst({
        where: {
          businessId,
          doctype: t.doctype,
          isDefault: true,
          name: { not: t.name },
        },
      })
      if (existingDefault) isDefault = false
    }

    await db.pdfTemplate.upsert({
      where: { businessId_name: { businessId, name: t.name } },
      update: {}, // No-op if exists — preserves any user edits
      create: {
        businessId,
        name: t.name,
        doctype: t.doctype,
        htmlContent: t.htmlContent,
        cssContent: t.cssContent,
        isDefault,
        isSystem: true,
      },
    })
  }
}
