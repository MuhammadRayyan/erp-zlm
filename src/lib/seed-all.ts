import { db } from './db'
import { hashPassword } from './auth'
import { UAE_CHART_OF_ACCOUNTS } from './constants'
import { seedChartOfAccounts, seedTaxRates, seedCurrencies, seedDefaultTemplates } from './seed'

// ============================================================
// COMPREHENSIVE SEED DATA
// Creates: Plans, Platform Admin, Test Tenants, Users, Businesses, Sample Data
// ============================================================

export async function seedAll() {
  // 1. Create Plans
  await seedPlans()

  // 2. Create Platform Admin
  await seedPlatformAdmin()

  // 3. Create test tenants with users and businesses
  await seedTestTenant1()
  await seedTestTenant2()
  await seedTestTenant3()

  // 4. Mark as seeded
  await db.appSetting.upsert({
    where: { key: 'seeded' },
    update: { value: 'true' },
    create: { key: 'seeded', value: 'true' },
  })

  console.log('✓ All seed data created successfully')
}

async function seedPlans() {
  const existing = await db.plan.count()
  if (existing > 0) return

  await db.plan.createMany({
    data: [
      {
        name: 'Free',
        description: 'For solo entrepreneurs getting started',
        maxBusinesses: 1,
        maxUsers: 1,
        maxInvoicesPerMonth: 50,
        priceMonthly: 0,
        priceYearly: 0,
        features: JSON.stringify({ eInvoicing: false, api: false, customTemplates: false, multiCurrency: false }),
        isPublic: true,
      },
      {
        name: 'Starter',
        description: 'For small businesses with basic needs',
        maxBusinesses: 1,
        maxUsers: 3,
        maxInvoicesPerMonth: 200,
        priceMonthly: 49,
        priceYearly: 490,
        features: JSON.stringify({ eInvoicing: false, api: false, customTemplates: true, multiCurrency: true }),
        isPublic: true,
      },
      {
        name: 'Professional',
        description: 'For growing businesses with multiple users',
        maxBusinesses: 3,
        maxUsers: 10,
        maxInvoicesPerMonth: 0,
        priceMonthly: 149,
        priceYearly: 1490,
        features: JSON.stringify({ eInvoicing: true, api: true, customTemplates: true, multiCurrency: true, bankFeeds: true }),
        isPublic: true,
      },
      {
        name: 'Enterprise',
        description: 'For large organizations with advanced needs',
        maxBusinesses: 10,
        maxUsers: 50,
        maxInvoicesPerMonth: 0,
        priceMonthly: 399,
        priceYearly: 3990,
        features: JSON.stringify({ eInvoicing: true, api: true, customTemplates: true, multiCurrency: true, bankFeeds: true, sso: true, auditLog: true }),
        isPublic: true,
      },
    ],
  })
  console.log('  ✓ Plans created (Free, Starter, Professional, Enterprise)')
}

async function seedPlatformAdmin() {
  const existing = await db.user.findUnique({ where: { email: 'admin@accounterp.com' } })
  if (existing) return

  const passwordHash = await hashPassword('Admin@123456')
  await db.user.create({
    data: {
      email: 'admin@accounterp.com',
      name: 'Platform Admin',
      passwordHash,
      role: 'PLATFORM_ADMIN',
    },
  })
  console.log('  ✓ Platform Admin created (admin@accounterp.com / Admin@123456)')
}

async function seedTestTenant1() {
  // Tech Solutions LLC — Professional plan, 2 businesses, 3 users
  const existing = await db.tenant.findUnique({ where: { slug: 'tech-solutions' } })
  if (existing) return

  const professionalPlan = await db.plan.findUnique({ where: { name: 'Professional' } })
  if (!professionalPlan) return

  const tenant = await db.tenant.create({
    data: {
      name: 'Tech Solutions LLC',
      slug: 'tech-solutions',
      email: 'owner@techsolutions.ae',
      phone: '+971 50 123 4567',
      status: 'ACTIVE',
    },
  })

  await db.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: professionalPlan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  })

  // Users
  const ownerHash = await hashPassword('Owner@123456')
  const owner = await db.user.create({
    data: { email: 'owner@techsolutions.ae', name: 'Ahmed Al Rashid', passwordHash: ownerHash, role: 'USER' },
  })
  await db.userTenant.create({
    data: { userId: owner.id, tenantId: tenant.id, role: 'TENANT_ADMIN', joinedAt: new Date() },
  })

  const accountantHash = await hashPassword('Account@123')
  const accountant = await db.user.create({
    data: { email: 'accountant@techsolutions.ae', name: 'Fatima Al Zahra', passwordHash: accountantHash, role: 'USER' },
  })
  await db.userTenant.create({
    data: { userId: accountant.id, tenantId: tenant.id, role: 'ACCOUNTANT', joinedAt: new Date() },
  })

  const viewerHash = await hashPassword('Viewer@123')
  const viewer = await db.user.create({
    data: { email: 'viewer@techsolutions.ae', name: 'John Smith', passwordHash: viewerHash, role: 'USER' },
  })
  await db.userTenant.create({
    data: { userId: viewer.id, tenantId: tenant.id, role: 'VIEWER', joinedAt: new Date() },
  })

  // Business 1: Tech Solutions LLC (main)
  const business1 = await db.business.create({
    data: {
      tenantId: tenant.id,
      name: 'Tech Solutions LLC',
      legalName: 'Tech Solutions LLC',
      trn: '100123456700003',
      email: 'info@techsolutions.ae',
      phone: '+971 4 123 4567',
      addressLine1: 'Office 1201, Business Bay Tower',
      city: 'Dubai',
      state: 'Dubai',
      country: 'AE',
      baseCurrency: 'AED',
      vatRegistered: true,
      vatRate: 5.0,
    },
  })
  await seedChartOfAccounts(business1.id)
  await seedTaxRates(business1.id)
  await seedCurrencies(business1.id)
  await seedDefaultTemplates(business1.id)

  // Business 2: Tech Solutions Trading (second business)
  const business2 = await db.business.create({
    data: {
      tenantId: tenant.id,
      name: 'Tech Solutions Trading',
      legalName: 'Tech Solutions Trading FZE',
      trn: '100123456700011',
      email: 'trading@techsolutions.ae',
      phone: '+971 4 765 4321',
      addressLine1: 'FZ-LLC, JLT Cluster X',
      city: 'Dubai',
      state: 'Dubai',
      country: 'AE',
      baseCurrency: 'AED',
      vatRegistered: true,
      vatRate: 5.0,
    },
  })
  await seedChartOfAccounts(business2.id)
  await seedTaxRates(business2.id)
  await seedCurrencies(business2.id)
  await seedDefaultTemplates(business2.id)

  // Create sample data for business 1
  await createSampleData(business1.id, owner.id)

  console.log('  ✓ Tenant: Tech Solutions LLC (Professional plan, 3 users, 2 businesses)')
}

async function seedTestTenant2() {
  // Al Madina Trading — Starter plan, 1 business, 2 users
  const existing = await db.tenant.findUnique({ where: { slug: 'al-madina-trading' } })
  if (existing) return

  const starterPlan = await db.plan.findUnique({ where: { name: 'Starter' } })
  if (!starterPlan) return

  const tenant = await db.tenant.create({
    data: {
      name: 'Al Madina Trading',
      slug: 'al-madina-trading',
      email: 'info@almadina.ae',
      phone: '+971 55 987 6543',
      status: 'ACTIVE',
    },
  })

  await db.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      billingCycle: 'YEARLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
    },
  })

  const ownerHash = await hashPassword('Madina@123')
  const owner = await db.user.create({
    data: { email: 'owner@almadina.ae', name: 'Omar Al Madina', passwordHash: ownerHash, role: 'USER' },
  })
  await db.userTenant.create({
    data: { userId: owner.id, tenantId: tenant.id, role: 'TENANT_ADMIN', joinedAt: new Date() },
  })

  const accountantHash = await hashPassword('Account@123')
  const accountant = await db.user.create({
    data: { email: 'accounts@almadina.ae', name: 'Sara Ahmed', passwordHash: accountantHash, role: 'USER' },
  })
  await db.userTenant.create({
    data: { userId: accountant.id, tenantId: tenant.id, role: 'ACCOUNTANT', joinedAt: new Date() },
  })

  const business = await db.business.create({
    data: {
      tenantId: tenant.id,
      name: 'Al Madina Trading',
      legalName: 'Al Madina Trading LLC',
      trn: '100987654300003',
      email: 'info@almadina.ae',
      phone: '+971 6 555 1234',
      addressLine1: 'Industrial Area 12, Sharjah',
      city: 'Sharjah',
      state: 'Sharjah',
      country: 'AE',
      baseCurrency: 'AED',
      vatRegistered: true,
      vatRate: 5.0,
    },
  })
  await seedChartOfAccounts(business.id)
  await seedTaxRates(business.id)
  await seedCurrencies(business.id)
  await seedDefaultTemplates(business.id)

  await createSampleData(business.id, owner.id)

  console.log('  ✓ Tenant: Al Madina Trading (Starter plan, 2 users, 1 business)')
}

async function seedTestTenant3() {
  // Trial Tenant — Free plan, on trial
  const existing = await db.tenant.findUnique({ where: { slug: 'startup-fresh' } })
  if (existing) return

  const freePlan = await db.plan.findUnique({ where: { name: 'Free' } })
  if (!freePlan) return

  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + 10) // 10 days left in trial

  const tenant = await db.tenant.create({
    data: {
      name: 'Startup Fresh',
      slug: 'startup-fresh',
      email: 'founder@startupfresh.ae',
      status: 'TRIAL',
      trialEndsAt: trialEnds,
    },
  })

  await db.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: freePlan.id,
      status: 'TRIAL',
      billingCycle: 'MONTHLY',
      trialEndsAt: trialEnds,
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnds,
    },
  })

  const ownerHash = await hashPassword('Startup@123')
  const owner = await db.user.create({
    data: { email: 'founder@startupfresh.ae', name: 'Khalid Mohammed', passwordHash: ownerHash, role: 'USER' },
  })
  await db.userTenant.create({
    data: { userId: owner.id, tenantId: tenant.id, role: 'TENANT_ADMIN', joinedAt: new Date() },
  })

  const business = await db.business.create({
    data: {
      tenantId: tenant.id,
      name: 'Startup Fresh',
      baseCurrency: 'AED',
      vatRegistered: false, // Below threshold
      vatRate: 0,
    },
  })
  await seedChartOfAccounts(business.id)
  await seedTaxRates(business.id)
  await seedCurrencies(business.id)
  await seedDefaultTemplates(business.id)

  console.log('  ✓ Tenant: Startup Fresh (Free plan, TRIAL, 1 user, 1 business, not VAT registered)')
}

// ============================================================
// SAMPLE DATA (customers, suppliers, invoices, bills, payments)
// ============================================================

async function createSampleData(businessId: string, userId: string) {
  // Customers
  const customer1 = await db.party.create({
    data: {
      businessId,
      code: 'C001',
      name: 'Emirates Construction LLC',
      trn: '100200300400003',
      email: 'accounts@emirates-construction.ae',
      phone: '+971 4 333 2222',
      type: 'CUSTOMER',
      billingAddress1: 'Sheikh Zayed Road, Dubai',
      billingCity: 'Dubai',
      billingState: 'Dubai',
      billingCountry: 'AE',
      paymentTerms: 30,
      creditLimit: 50000,
    },
  })

  const customer2 = await db.party.create({
    data: {
      businessId,
      code: 'C002',
      name: 'Gulf Retail Group',
      trn: '100300400500003',
      email: 'finance@gulfretail.ae',
      phone: '+971 2 444 5555',
      type: 'CUSTOMER',
      billingAddress1: 'Abu Dhabi Mall',
      billingCity: 'Abu Dhabi',
      billingState: 'Abu Dhabi',
      billingCountry: 'AE',
      paymentTerms: 15,
      creditLimit: 30000,
    },
  })

  const customer3 = await db.party.create({
    data: {
      businessId,
      code: 'C003',
      name: 'Walk-in Customer',
      type: 'CUSTOMER',
      billingCountry: 'AE',
      paymentTerms: 0,
    },
  })

  // Suppliers
  const supplier1 = await db.party.create({
    data: {
      businessId,
      code: 'S001',
      name: 'Global Tech Distributors',
      trn: '100400500600003',
      email: 'orders@globaltechdist.com',
      phone: '+971 4 666 7777',
      type: 'SUPPLIER',
      billingAddress1: 'Jebel Ali Free Zone',
      billingCity: 'Dubai',
      billingState: 'Dubai',
      billingCountry: 'AE',
      paymentTerms: 45,
    },
  })

  const supplier2 = await db.party.create({
    data: {
      businessId,
      code: 'S002',
      name: 'Office Supplies Co.',
      trn: '100500600700003',
      email: 'sales@officesupplies.ae',
      phone: '+971 6 888 9999',
      type: 'SUPPLIER',
      billingAddress1: 'Industrial Area 5, Sharjah',
      billingCity: 'Sharjah',
      billingState: 'Sharjah',
      billingCountry: 'AE',
      paymentTerms: 30,
    },
  })

  // Items
  const item1 = await db.item.create({
    data: {
      businessId,
      sku: 'LAP-001',
      name: 'Dell Latitude Laptop',
      description: 'Dell Latitude 5520, i7, 16GB RAM, 512GB SSD',
      unit: 'PCS',
      category: 'Electronics',
      salePrice: 4500,
      purchasePrice: 3800,
      stockQty: 25,
      reorderLevel: 5,
    },
  })

  const item2 = await db.item.create({
    data: {
      businessId,
      sku: 'MON-001',
      name: 'Samsung 27" Monitor',
      description: 'Samsung S27A600 27" QHD Monitor',
      unit: 'PCS',
      category: 'Electronics',
      salePrice: 1200,
      purchasePrice: 900,
      stockQty: 40,
      reorderLevel: 10,
    },
  })

  const item3 = await db.item.create({
    data: {
      businessId,
      sku: 'SVC-001',
      name: 'IT Support Service',
      description: 'Monthly IT support and maintenance',
      unit: 'HR',
      category: 'Services',
      salePrice: 250,
      purchasePrice: 0,
      stockQty: 0,
      isInventory: false,
    },
  })

  // Get tax rate
  const vatRate = await db.taxRate.findFirst({ where: { businessId, name: 'VAT 5%' } })
  const salesAccount = await db.account.findFirst({ where: { businessId, subtype: 'SALES' } })
  const arAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_RECEIVABLE' } })
  const vatOutputAccount = await db.account.findFirst({ where: { businessId, code: '2220' } })

  // Sales Invoices (posted)
  const business = await db.business.findUnique({ where: { id: businessId } })
  let invNum = business!.nextInvoiceNumber

  // Invoice 1: Posted, partially paid
  const inv1 = await db.salesInvoice.create({
    data: {
      businessId,
      number: `${business!.invoicePrefix}${String(invNum++).padStart(6, '0')}`,
      date: new Date(Date.now() - 20 * 86400000),
      dueDate: new Date(Date.now() - 20 * 86400000 + 30 * 86400000),
      partyId: customer1.id,
      currency: 'AED',
      subtotal: 13500,
      totalTax: 675,
      total: 14175,
      amountPaid: 7000,
      status: 'PARTIALLY_PAID',
      postedAt: new Date(Date.now() - 20 * 86400000),
      createdById: userId,
      notes: 'Thank you for your business',
      terms: 'Payment due within 30 days',
      lines: {
        create: [
          { description: 'Dell Latitude Laptop x3', quantity: 3, unitPrice: 4500, discount: 0, position: 0, taxRateId: vatRate?.id, lineTotal: 13500, lineTax: 675 },
        ],
      },
    },
  })

  // Post journal entry for inv1
  if (arAccount && salesAccount) {
    await db.journalEntry.create({
      data: {
        businessId,
        number: `JE-${String(Date.now()).slice(-6)}`,
        date: new Date(Date.now() - 20 * 86400000),
        reference: `Invoice ${inv1.number}`,
        description: `Sales Invoice ${inv1.number}`,
        sourceType: 'SALES_INVOICE',
        sourceId: inv1.id,
        isPosted: true,
        postedAt: new Date(Date.now() - 20 * 86400000),
        createdById: userId,
        lines: {
          create: [
            { accountId: arAccount.id, debit: 14175, credit: 0, partyId: customer1.id, description: `Invoice ${inv1.number}` },
            { accountId: salesAccount.id, debit: 0, credit: 13500, description: `Sales - ${inv1.number}` },
            ...(vatOutputAccount ? [{ accountId: vatOutputAccount.id, debit: 0, credit: 675, description: `Output VAT - ${inv1.number}` }] : []),
          ],
        },
      },
    })
  }

  // Invoice 2: Posted, paid
  const inv2 = await db.salesInvoice.create({
    data: {
      businessId,
      number: `${business!.invoicePrefix}${String(invNum++).padStart(6, '0')}`,
      date: new Date(Date.now() - 15 * 86400000),
      dueDate: new Date(Date.now() - 15 * 86400000 + 15 * 86400000),
      partyId: customer2.id,
      currency: 'AED',
      subtotal: 6000,
      totalTax: 300,
      total: 6300,
      amountPaid: 6300,
      status: 'PAID',
      postedAt: new Date(Date.now() - 15 * 86400000),
      createdById: userId,
      lines: {
        create: [
          { description: 'Samsung 27" Monitor x5', quantity: 5, unitPrice: 1200, discount: 0, position: 0, taxRateId: vatRate?.id, lineTotal: 6000, lineTax: 300 },
        ],
      },
    },
  })

  // Invoice 3: Draft
  await db.salesInvoice.create({
    data: {
      businessId,
      number: `${business!.invoicePrefix}${String(invNum++).padStart(6, '0')}`,
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      partyId: customer1.id,
      currency: 'AED',
      subtotal: 2250,
      totalTax: 112.5,
      total: 2362.5,
      amountPaid: 0,
      status: 'DRAFT',
      createdById: userId,
      lines: {
        create: [
          { description: 'IT Support Service x9 hours', quantity: 9, unitPrice: 250, discount: 0, position: 0, taxRateId: vatRate?.id, lineTotal: 2250, lineTax: 112.5 },
        ],
      },
    },
  })

  // Update next invoice number
  await db.business.update({ where: { id: businessId }, data: { nextInvoiceNumber: invNum } })

  // Purchase Bills
  const apAccount = await db.account.findFirst({ where: { businessId, subtype: 'ACCOUNTS_PAYABLE' } })
  const purchasesAccount = await db.account.findFirst({ where: { businessId, subtype: 'COST_OF_GOODS_SOLD' } })
  const vatInputAccount = await db.account.findFirst({ where: { businessId, code: '2210' } })

  let billNum = business!.nextBillNumber
  const bill1 = await db.purchaseBill.create({
    data: {
      businessId,
      number: `${business!.billPrefix}${String(billNum++).padStart(6, '0')}`,
      date: new Date(Date.now() - 10 * 86400000),
      dueDate: new Date(Date.now() - 10 * 86400000 + 45 * 86400000),
      partyId: supplier1.id,
      supplierInvoiceNumber: 'GT-2024-5678',
      currency: 'AED',
      subtotal: 19000,
      totalTax: 950,
      total: 19950,
      amountPaid: 0,
      status: 'POSTED',
      postedAt: new Date(Date.now() - 10 * 86400000),
      createdById: userId,
      lines: {
        create: [
          { description: 'Dell Latitude Laptops x5', quantity: 5, unitPrice: 3800, discount: 0, position: 0, taxRateId: vatRate?.id, lineTotal: 19000, lineTax: 950 },
        ],
      },
    },
  })

  if (apAccount && purchasesAccount) {
    await db.journalEntry.create({
      data: {
        businessId,
        number: `JE-${String(Date.now() + 1).slice(-6)}`,
        date: new Date(Date.now() - 10 * 86400000),
        reference: `Bill ${bill1.number}`,
        description: `Purchase Bill ${bill1.number}`,
        sourceType: 'PURCHASE_BILL',
        sourceId: bill1.id,
        isPosted: true,
        postedAt: new Date(Date.now() - 10 * 86400000),
        createdById: userId,
        lines: {
          create: [
            { accountId: purchasesAccount.id, debit: 19000, credit: 0, description: `Purchase - ${bill1.number}` },
            ...(vatInputAccount ? [{ accountId: vatInputAccount.id, debit: 950, credit: 0, description: `Input VAT - ${bill1.number}` }] : []),
            { accountId: apAccount.id, debit: 0, credit: 19950, partyId: supplier1.id, description: `Bill ${bill1.number}` },
          ],
        },
      },
    })
  }

  await db.business.update({ where: { id: businessId }, data: { nextBillNumber: billNum } })

  // Payment — receipt from customer2 for inv2
  const cashAccount = await db.account.findFirst({ where: { businessId, subtype: 'CASH' } })
  let pmtNum = business!.nextReceiptNumber
  await db.payment.create({
    data: {
      businessId,
      number: `${business!.receiptPrefix}${String(pmtNum++).padStart(6, '0')}`,
      date: new Date(Date.now() - 10 * 86400000),
      type: 'RECEIPT',
      partyId: customer2.id,
      amount: 6300,
      currency: 'AED',
      method: 'BANK_TRANSFER',
      reference: 'BNK-TRF-001',
      description: 'Payment for invoice ' + inv2.number,
      status: 'POSTED',
      createdById: userId,
      allocations: { create: [{ invoiceId: inv2.id, amount: 6300 }] },
    },
  })

  // Post payment journal
  if (arAccount && cashAccount) {
    await db.journalEntry.create({
      data: {
        businessId,
        number: `JE-${String(Date.now() + 2).slice(-6)}`,
        date: new Date(Date.now() - 10 * 86400000),
        reference: `Receipt ${business!.receiptPrefix}${String(pmtNum - 1).padStart(6, '0')}`,
        description: 'Receipt from Gulf Retail Group',
        sourceType: 'PAYMENT',
        isPosted: true,
        postedAt: new Date(Date.now() - 10 * 86400000),
        createdById: userId,
        lines: {
          create: [
            { accountId: cashAccount.id, debit: 6300, credit: 0, description: 'Receipt' },
            { accountId: arAccount.id, debit: 0, credit: 6300, partyId: customer2.id, description: 'Receipt' },
          ],
        },
      },
    })
  }

  await db.business.update({ where: { id: businessId }, data: { nextReceiptNumber: pmtNum } })

  // Bank account
  const bankGlAccount = await db.account.findFirst({ where: { businessId, subtype: 'BANK' } })
  if (bankGlAccount) {
    await db.bankAccount.create({
      data: {
        businessId,
        name: 'Emirates NBD - Current',
        accountNumber: '1012345678901',
        bankName: 'Emirates NBD',
        iban: 'AE070331234567890123456',
        openingBalance: 25000,
        currentBalance: 31300, // 25000 + 6300 receipt
        currency: 'AED',
      },
    })
  }
}
