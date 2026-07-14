import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, hashPassword, setSession } from '@/lib/auth'
import { checkLoginRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limiting — prevent brute force attacks
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
    if (!checkLoginRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '300' } })
    }
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

    // Audit log: successful login (only if we have a real tenant with a business)
    if (membership?.tenantId) {
      const biz = await db.business.findFirst({ where: { tenantId: membership.tenantId }, select: { id: true } })
      if (biz) {
        await db.auditLog.create({
          data: {
            businessId: biz.id,
            tenantId: membership.tenantId,
            userId: user.id,
            action: 'LOGIN',
            entityType: 'AUTH',
            entityId: user.id,
            description: `User ${user.email} logged in successfully${user.role === 'PLATFORM_ADMIN' ? ' (Platform Admin)' : ''}`,
            ipAddress: ip,
          },
        }).catch(() => {})
      }
    }

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
    console.error('[API Error]', e); return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
