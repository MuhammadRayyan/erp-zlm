import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, hashPassword, setSession } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user || !user.passwordHash || !user.isActive) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Update last login
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

    // Find the user's first tenant membership (if any)
    const membership = await db.userTenant.findFirst({
      where: { userId: user.id, isActive: true },
      include: { tenant: true },
      orderBy: { joinedAt: 'asc' },
    })

    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: membership?.tenantId || null,
      tenantRole: membership?.role || null,
    })

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: membership?.tenantId || null,
      tenantName: membership?.tenant.name || null,
      tenantRole: membership?.role || null,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
