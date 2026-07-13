import { NextResponse } from 'next/server'
import { clearSession, getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST() {
  const session = await getSession()

  // Audit log: logout (only if we have valid tenant + business)
  if (session?.userId && session?.tenantId) {
    try {
      const biz = await db.business.findFirst({ where: { tenantId: session.tenantId }, select: { id: true } })
      if (biz) {
        await db.auditLog.create({
          data: {
            businessId: biz.id,
            tenantId: session.tenantId,
            userId: session.userId,
            action: 'LOGOUT',
            entityType: 'AUTH',
            entityId: session.userId,
            description: `User ${session.email} logged out`,
          },
        })
      }
    } catch {}
  }

  await clearSession()
  return NextResponse.json({ ok: true })
}
