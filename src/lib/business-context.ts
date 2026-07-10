import { cookies } from 'next/headers'
import { db } from './db'

// Get the current business context from cookie
export async function getCurrentBusinessId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('businessId')?.value || null
}

export async function getCurrentBusiness() {
  const id = await getCurrentBusinessId()
  if (!id) return null
  return db.business.findUnique({ where: { id } })
}

// Get or create the default business (for single-user / self-hosted mode)
export async function ensureDefaultBusiness(): Promise<string> {
  const existing = await getCurrentBusinessId()
  if (existing) {
    const biz = await db.business.findUnique({ where: { id: existing } })
    if (biz) return biz.id
  }

  // Find any business
  const anyBusiness = await db.business.findFirst({ orderBy: { createdAt: 'asc' } })
  if (anyBusiness) {
    return anyBusiness.id
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

  return business.id
}

// Require a business context — throws if none
export async function requireBusinessId(): Promise<string> {
  const id = await ensureDefaultBusiness()
  return id
}
