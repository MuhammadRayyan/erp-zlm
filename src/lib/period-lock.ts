import { getBusinessSetting, setBusinessSetting } from './settings'

interface LockedPeriod {
  startDate: string
  endDate: string
  reason?: string
  lockedAt: string
  lockedBy?: string
}

export async function isPeriodLocked(businessId: string, date: Date): Promise<boolean> {
  try {
    const setting = await getBusinessSetting<string>(businessId, 'locked_periods')
    if (!setting) return false
    
    const periods = typeof setting === 'string' ? JSON.parse(setting) as LockedPeriod[] : setting as LockedPeriod[]
    const dateStr = date.toISOString().slice(0, 10)
    
    return periods.some(p => {
      const start = p.startDate.slice(0, 10)
      const end = p.endDate.slice(0, 10)
      return dateStr >= start && dateStr <= end
    })
  } catch {
    return false
  }
}

export async function lockPeriod(businessId: string, startDate: string, endDate: string, reason?: string, userId?: string): Promise<void> {
  const existing = await getBusinessSetting<string>(businessId, 'locked_periods')
  const periods: LockedPeriod[] = existing 
    ? (typeof existing === 'string' ? JSON.parse(existing) : existing)
    : []
  periods.push({ startDate, endDate, reason, lockedAt: new Date().toISOString(), lockedBy: userId })
  await setBusinessSetting(businessId, 'locked_periods', JSON.stringify(periods))
}

export async function unlockPeriod(businessId: string, startDate: string, endDate: string): Promise<void> {
  const existing = await getBusinessSetting<string>(businessId, 'locked_periods')
  if (!existing) return
  const periods: LockedPeriod[] = typeof existing === 'string' ? JSON.parse(existing) : existing
  const filtered = periods.filter(p => !(p.startDate === startDate && p.endDate === endDate))
  await setBusinessSetting(businessId, 'locked_periods', JSON.stringify(filtered))
}

export async function getLockedPeriods(businessId: string): Promise<LockedPeriod[]> {
  const existing = await getBusinessSetting<string>(businessId, 'locked_periods')
  if (!existing) return []
  return typeof existing === 'string' ? JSON.parse(existing) : existing
}
