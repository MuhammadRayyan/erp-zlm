import { NextResponse } from 'next/server'
import { clearSession, getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST() {
  const session = await getSession()

  // Audit log: logout
  if (session?.userId && session?.tenantId) {
    await db.auditLog.create({
      data: {
        businessId: 'system',
        tenantId: session.tenantId,
        userId: session.userId,
        action: 'LOGOUT',
        entityType: 'AUTH',
        entityId: session.userId,
        description: `User ${session.email} logged out`,
      },
    }).catch(() => {}) // Non-blocking
  }

  await clearSession()
  return NextResponse.json({ ok: true })
}
