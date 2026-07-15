// ============================================================
// One-off: restore the 3 records deleted during DELETE-endpoint
// permission verification (1 DRAFT invoice, 1 DRAFT bill, 1 item).
//
// Usage: cd /home/z/my-project && bun run scripts/restore-deleted-test-data.ts
// Idempotent: checks if each record already exists by number/sku before re-creating.
//
// Note: bun's Prisma runtime requires explicit `id` and `updatedAt` because
// the schema does not declare `@default(cuid())` / `@default(now())` on
// these fields. We generate ids with nanoid.
// ============================================================

import { db } from '@/lib/db'
import { nanoid } from 'nanoid'

async function main() {
  const tenant = await db.tenant.findUnique({ where: { slug: 'tech-solutions' } })
  if (!tenant) { console.error('Tenant tech-solutions not found'); process.exit(1) }
  const business = await db.business.findFirst({
    where: { tenantId: tenant.id, name: 'Tech Solutions LLC' },
    orderBy: { createdAt: 'asc' },
  })
  if (!business) { console.error('Business not found'); process.exit(1) }

  const ownerLink = await db.userTenant.findFirst({
    where: { tenantId: tenant.id, role: 'TENANT_ADMIN' },
    orderBy: { joinedAt: 'asc' },
  })
  if (!ownerLink) { console.error('No owner'); process.exit(1) }
  const userId = ownerLink.userId

  const vatStd = await db.taxRate.findFirst({ where: { businessId: business.id, name: 'VAT 5%' } })
  const customer1 = await db.party.findFirst({ where: { businessId: business.id, code: 'C001' } })
  const supplier1 = await db.party.findFirst({ where: { businessId: business.id, code: 'S001' } })

  // 1) Restore missing items by sku
  const items = {
    'LAP-001': { name: 'Dell Latitude Laptop', description: 'Dell Latitude 5520, i7, 16GB RAM, 512GB SSD', unit: 'PCS', category: 'Electronics', salePrice: 4500, purchasePrice: 3800, stockQty: 25, reorderLevel: 5, isInventory: true },
    'MON-001': { name: 'Samsung 27" Monitor', description: 'Samsung S27A600 27" QHD Monitor', unit: 'PCS', category: 'Electronics', salePrice: 1200, purchasePrice: 900, stockQty: 40, reorderLevel: 10, isInventory: true },
    'SVC-001': { name: 'IT Support Service', description: 'Monthly IT support and maintenance', unit: 'HR', category: 'Services', salePrice: 250, purchasePrice: 0, stockQty: 0, reorderLevel: 0, isInventory: false },
    'KBD-001': { name: 'Mechanical Keyboard', description: 'RGB Mechanical Keyboard, Blue Switches', unit: 'PCS', category: 'Electronics', salePrice: 350, purchasePrice: 220, stockQty: 50, reorderLevel: 10, isInventory: true },
    'PRT-001': { name: 'HP LaserJet Pro Printer', description: 'HP LaserJet Pro M404 monochrome printer', unit: 'PCS', category: 'Electronics', salePrice: 1800, purchasePrice: 1400, stockQty: 15, reorderLevel: 5, isInventory: true },
    'ACD-001': { name: 'Annual Domain Registration', description: 'Annual .com domain registration service', unit: 'YR', category: 'Services', salePrice: 350, purchasePrice: 0, stockQty: 0, reorderLevel: 0, isInventory: false },
    'CHR-001': { name: 'Ergonomic Office Chair', description: 'Mesh-back ergonomic office chair', unit: 'PCS', category: 'Furniture', salePrice: 850, purchasePrice: 550, stockQty: 20, reorderLevel: 5, isInventory: true },
    'DSK-001': { name: 'Standing Desk', description: 'Electric height-adjustable standing desk', unit: 'PCS', category: 'Furniture', salePrice: 2200, purchasePrice: 1600, stockQty: 8, reorderLevel: 3, isInventory: true },
  } as const

  let itemsRestored = 0
  for (const [sku, def] of Object.entries(items)) {
    const exists = await db.item.findUnique({ where: { businessId_sku: { businessId: business.id, sku } } })
    if (exists) continue
    await db.item.create({
      data: {
        id: nanoid(),
        businessId: business.id, sku, name: def.name, description: def.description,
        unit: def.unit, category: def.category, salePrice: def.salePrice,
        purchasePrice: def.purchasePrice, stockQty: def.stockQty,
        reorderLevel: def.reorderLevel,
        isInventory: def.isInventory,
        updatedAt: new Date(),
      } as any,
    })
    itemsRestored++
    console.log(`  ✓ Restored item ${sku}`)
  }

  // 2) Restore DRAFT invoice INV-000003 (original from createSampleData)
  const inv3 = await db.salesInvoice.findUnique({
    where: { businessId_number: { businessId: business.id, number: 'INV-000003' } },
  })
  let invRestored = 0
  if (!inv3 && customer1) {
    const invId = nanoid()
    const lineId = nanoid()
    await db.salesInvoice.create({
      data: {
        id: invId,
        businessId: business.id,
        number: 'INV-000003',
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        partyId: customer1.id,
        currency: 'AED',
        subtotal: 2250, totalTax: 112.5, total: 2362.5,
        amountPaid: 0, status: 'DRAFT',
        createdById: userId,
        updatedAt: new Date(),
        SalesInvoiceLine: {
          create: [{
            id: lineId,
            description: 'IT Support Service x9 hours',
            quantity: 9, unitPrice: 250, discount: 0, position: 0,
            taxRateId: vatStd?.id || null, lineTotal: 2250, lineTax: 112.5,
          }],
        },
      } as any,
    })
    invRestored++
    console.log('  ✓ Restored invoice INV-000003')
  }

  // 2b) Restore DRAFT invoice INV-000008 (DRAFT Exempt from addMoreTestData —
  //     was the one actually deleted during the DELETE endpoint test).
  const custExempt = await db.party.findFirst({ where: { businessId: business.id, code: 'C005' } })
  const vatExempt = await db.taxRate.findFirst({ where: { businessId: business.id, name: 'Exempt' } })
  const inv8 = await db.salesInvoice.findUnique({
    where: { businessId_number: { businessId: business.id, number: 'INV-000008' } },
  })
  if (!inv8 && custExempt) {
    const invId = nanoid()
    const lineId = nanoid()
    await db.salesInvoice.create({
      data: {
        id: invId,
        businessId: business.id,
        number: 'INV-000008',
        date: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        partyId: custExempt.id,
        currency: 'AED',
        subtotal: 2200, totalTax: 0, total: 2200,
        amountPaid: 0, status: 'DRAFT',
        notes: 'Exempt supply — charity foundation',
        createdById: userId,
        updatedAt: new Date(),
        SalesInvoiceLine: {
          create: [{
            id: lineId,
            description: 'Standing Desk x1',
            quantity: 1, unitPrice: 2200, discount: 0, position: 0,
            taxRateId: vatExempt?.id || null, lineTotal: 2200, lineTax: 0,
          }],
        },
      } as any,
    })
    invRestored++
    console.log('  ✓ Restored invoice INV-000008 (DRAFT Exempt)')
  }

  // 3) Restore DRAFT bill BILL-000004
  const bill4 = await db.purchaseBill.findUnique({
    where: { businessId_number: { businessId: business.id, number: 'BILL-000004' } },
  })
  let billsRestored = 0
  if (!bill4 && supplier1) {
    const billId = nanoid()
    const lineId = nanoid()
    await db.purchaseBill.create({
      data: {
        id: billId,
        businessId: business.id,
        number: 'BILL-000004',
        date: new Date(),
        dueDate: new Date(Date.now() + 45 * 86400000),
        partyId: supplier1.id,
        supplierInvoiceNumber: 'GT-2024-9999',
        currency: 'AED',
        subtotal: 7000, totalTax: 350, total: 7350,
        amountPaid: 0, status: 'DRAFT',
        createdById: userId,
        updatedAt: new Date(),
        PurchaseBillLine: {
          create: [{
            id: lineId,
            description: 'HP LaserJet Pro Printer x5',
            quantity: 5, unitPrice: 1400, discount: 0, position: 0,
            taxRateId: vatStd?.id || null, lineTotal: 7000, lineTax: 350,
          }],
        },
      } as any,
    })
    billsRestored++
    console.log('  ✓ Restored bill BILL-000004')
  }

  console.log(`Restored: ${itemsRestored} items, ${invRestored} invoices, ${billsRestored} bills`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
