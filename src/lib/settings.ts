// AppSetting-backed key/value storage helpers.
// Used by routes that need to persist business-scoped JSON config without
// a dedicated Prisma model (e.g. accounting settings, recurring transactions,
// budgets, fiscal years, dashboard config, email config, etc.).
//
// Settings are stored in the AppSetting table with a stringified JSON value.
// Keys follow the convention `<namespace>_<businessId>` (or
// `<namespace>_<businessId>_<userId>` for user-scoped settings).

import { db } from './db'

/** Get a setting by its full key, parsed as JSON. Returns null if missing/invalid. */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const row = await db.appSetting.findUnique({ where: { key } })
  if (!row) return null
  try {
    return JSON.parse(row.value) as T
  } catch {
    return null
  }
}

/** Upsert a setting by key. Value is JSON-stringified. */
export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value)
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: json },
    update: { value: json },
  })
}

/** Delete a setting by key (no-op if missing). */
export async function deleteSetting(key: string): Promise<void> {
  await db.appSetting.deleteMany({ where: { key } })
}

/** Get a business-scoped setting using the convention `<namespace>_<businessId>`. */
export async function getBusinessSetting<T = unknown>(
  businessId: string,
  namespace: string
): Promise<T | null> {
  return getSetting<T>(`${namespace}_${businessId}`)
}

/** Upsert a business-scoped setting using the convention `<namespace>_<businessId>`. */
export async function setBusinessSetting(
  businessId: string,
  namespace: string,
  value: unknown
): Promise<void> {
  await setSetting(`${namespace}_${businessId}`, value)
}

/** Delete a business-scoped setting. */
export async function deleteBusinessSetting(
  businessId: string,
  namespace: string
): Promise<void> {
  await deleteSetting(`${namespace}_${businessId}`)
}
