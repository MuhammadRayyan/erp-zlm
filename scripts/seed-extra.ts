// ============================================================
// One-off script: applies addMoreTestData to the existing
// "Tech Solutions LLC" business (tenant: tech-solutions).
//
// Usage: cd /home/z/my-project && bun run scripts/seed-extra.ts
// Idempotent: addMoreTestData checks for party C004 before running.
// ============================================================

import { db } from '@/lib/db'
import { addMoreTestData } from '@/lib/seed-all'

async function main() {
  // Find the Tech Solutions LLC tenant + its first business (Tech Solutions LLC)
  const tenant = await db.tenant.findUnique({ where: { slug: 'tech-solutions' } })
  if (!tenant) {
    console.error('Tenant "tech-solutions" not found. Run `bun run scripts/seed-all-runner.ts` first.')
    process.exit(1)
  }

  const business = await db.business.findFirst({
    where: { tenantId: tenant.id, name: 'Tech Solutions LLC' },
    orderBy: { createdAt: 'asc' },
  })
  if (!business) {
    console.error('Business "Tech Solutions LLC" not found in tenant.')
    process.exit(1)
  }

  // Find the tenant owner (TENANT_ADMIN) — first joined user
  const ownerLink = await db.userTenant.findFirst({
    where: { tenantId: tenant.id, role: 'TENANT_ADMIN' },
    orderBy: { joinedAt: 'asc' },
  })
  if (!ownerLink) {
    console.error('No TENANT_ADMIN found in tenant.')
    process.exit(1)
  }

  console.log(`Applying extra test data to business "${business.name}" (${business.id}) as user ${ownerLink.userId}…`)
  await addMoreTestData(business.id, ownerLink.userId)
  console.log('Done.')
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e)
    process.exit(1)
  })
