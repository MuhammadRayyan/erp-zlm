import { NextRequest, NextResponse } from 'next/server'
import { ensureBusinessId, AuthError } from '@/lib/auth'
import { getBusinessSetting, setBusinessSetting } from '@/lib/settings'

// SMTP configuration for outgoing email.
// Stored in AppSetting with key `email_config_{businessId}`.
// NOTE: the `password` field is stored as-is. In production, encrypt at rest
// using a KMS or app-level symmetric encryption — this implementation
// deliberately keeps things simple for local/dev deployments.
export interface EmailConfig {
  host: string
  port: number
  secure: boolean // true for 465, false for 587 (STARTTLS)
  username: string
  password: string
  fromAddress: string
  fromName?: string
  replyTo?: string
  enabled: boolean
}

const NAMESPACE = 'email_config'

const DEFAULTS: EmailConfig = {
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromAddress: '',
  fromName: '',
  replyTo: '',
  enabled: false,
}

// GET /api/email/config — fetch the current SMTP config (password masked)
export async function GET() {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
  const stored = await getBusinessSetting<EmailConfig>(businessId, NAMESPACE)
  if (!stored) {
    return NextResponse.json({ ...DEFAULTS, password: '' })
  }
  // Mask the password in GET responses — clients must explicitly re-send it
  // to update. Use a sentinel so the frontend knows whether a password is set.
  return NextResponse.json({
    ...DEFAULTS,
    ...stored,
    password: '',
    hasPassword: !!stored.password,
  })
}

// POST /api/email/config — save SMTP config
// Body: { host, port, secure, username, password?, fromAddress, fromName?, replyTo?, enabled? }
// If `password` is empty/undefined, the existing password is preserved.
export async function POST(req: NextRequest) {
  let businessId: string
  try {
    businessId = await ensureBusinessId()
  } catch (e) {
    if (e instanceof AuthError || (e as Error).message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  const body = await req.json()
  const stored = (await getBusinessSetting<EmailConfig>(businessId, NAMESPACE)) || DEFAULTS

  const merged: EmailConfig = {
    host: typeof body.host === 'string' ? body.host : stored.host,
    port: Number.isFinite(body.port) ? Number(body.port) : stored.port,
    secure: typeof body.secure === 'boolean' ? body.secure : stored.secure,
    username: typeof body.username === 'string' ? body.username : stored.username,
    password:
      typeof body.password === 'string' && body.password.length > 0
        ? body.password
        : stored.password,
    fromAddress: typeof body.fromAddress === 'string' ? body.fromAddress : stored.fromAddress,
    fromName:
      typeof body.fromName === 'string' ? body.fromName : stored.fromName || '',
    replyTo:
      typeof body.replyTo === 'string' ? body.replyTo : stored.replyTo || '',
    enabled: typeof body.enabled === 'boolean' ? body.enabled : stored.enabled,
  }
  await setBusinessSetting(businessId, NAMESPACE, merged)

  return NextResponse.json({
    ...merged,
    password: '',
    hasPassword: !!merged.password,
  })
}
