import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, verifyPassword, hashPassword, setSession } from '@/lib/auth'
import { z } from 'zod'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

// POST /api/auth/change-password
// Body: { currentPassword, newPassword }
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const parse = changePasswordSchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.issues },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = parse.data

  const user = await db.user.findUnique({ where: { id: session.userId } })
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'User has no password set' }, { status: 400 })
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must differ from current password' },
      { status: 400 }
    )
  }

  const newHash = await hashPassword(newPassword)
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  })

  // Re-issue the session token (validates the user is still authenticated)
  await setSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: session.tenantId,
    tenantRole: session.tenantRole,
    businessId: session.businessId,
  })

  // Best-effort audit log
  if (session.tenantId) {
    const biz = await db.business.findFirst({
      where: { tenantId: session.tenantId },
      select: { id: true },
    })
    if (biz) {
      await db.auditLog
        .create({
          data: {
            businessId: biz.id,
            tenantId: session.tenantId,
            userId: user.id,
            action: 'PASSWORD_CHANGED',
            entityType: 'AUTH',
            entityId: user.id,
            description: `User ${user.email} changed their password`,
          },
        })
        .catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}
