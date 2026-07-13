import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, setSession } from '@/lib/auth'
import { z } from 'zod'
import { checkRegisterRateLimit } from '@/lib/rate-limit'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Must contain at least one uppercase letter').regex(/[0-9]/, 'Must contain at least one number').regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  organization: z.string().min(2),
})

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
    if (!checkRegisterRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': '3600' } })
    }
    const body = await req.json()
    const { name, email, password, organization } = registerSchema.parse(body)

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    // Generate unique slug
    let slug = organization.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (!slug) slug = 'org'
    let slugSuffix = 0
    while (await db.tenant.findUnique({ where: { slug } })) {
      slugSuffix++
      slug = `${organization.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slugSuffix}`
    }

    // Get the default (Free) plan
    const freePlan = await db.plan.findFirst({ where: { name: 'Free' } }) ||
      await db.plan.findFirst({ orderBy: { priceMonthly: 'asc' } })

    // Create user
    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: 'USER',
      },
    })

    // Create tenant
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const tenant = await db.tenant.create({
      data: {
        name: organization,
        slug,
        email: email.toLowerCase(),
        status: 'TRIAL',
        trialEndsAt,
      },
    })

    // Create subscription
    if (freePlan) {
      await db.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: freePlan.id,
          status: 'TRIAL',
          billingCycle: 'MONTHLY',
          trialEndsAt,
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndsAt,
        },
      })
    }

    // Create membership (user is TENANT_ADMIN of their org)
    await db.userTenant.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: 'TENANT_ADMIN',
        joinedAt: new Date(),
      },
    })

    // Create default business
    const business = await db.business.create({
      data: {
        tenantId: tenant.id,
        name: organization,
        baseCurrency: 'AED',
        vatRegistered: true,
        vatRate: 5.0,
      },
    })

    // Seed chart of accounts, tax rates, currencies, templates
    const { seedChartOfAccounts, seedTaxRates, seedCurrencies, seedDefaultTemplates } = await import('@/lib/seed')
    await seedChartOfAccounts(business.id)
    await seedTaxRates(business.id)
    await seedCurrencies(business.id)
    await seedDefaultTemplates(business.id)

    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: tenant.id,
      tenantRole: 'TENANT_ADMIN',
    })

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantRole: 'TENANT_ADMIN',
      businessId: business.id,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
