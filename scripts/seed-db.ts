import { db } from '../src/lib/db'
import { seedAll } from '../src/lib/seed-all'

async function main() {
  await seedAll()
  const tenants = await db.tenant.count()
  const users = await db.user.count()
  const businesses = await db.business.count()
  const invoices = await db.salesInvoice.count()
  console.log(`✓ Tenants: ${tenants}, Users: ${users}, Businesses: ${businesses}`)
  console.log(`✓ Invoices: ${invoices}`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
