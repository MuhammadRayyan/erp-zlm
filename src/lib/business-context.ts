import { db } from './db'
import { getCurrentBusinessId, getCurrentBusiness, ensureBusinessId, getCurrentTenantId } from './auth'

// Re-export from auth module for backward compatibility
export { getCurrentBusinessId, getCurrentBusiness, ensureBusinessId, getCurrentTenantId }

export async function getCurrentTenant() {
  const tenantId = await getCurrentTenantId()
  if (!tenantId) return null
  return db.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: { include: { plan: true } } },
  })
}
