import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  ensureBusinessId,
  getCurrentTenantId,
  getSession,
  AuthError,
} from '@/lib/auth'
import { getBusinessSetting } from '@/lib/settings'
import type { EmailConfig } from '../config/route'

// Lazily load nodemailer if it's installed. We use a Function-wrapped dynamic
// import so TypeScript doesn't try to resolve the (optional) module at build
// time. If nodemailer isn't installed, the route degrades gracefully — the
// email body is logged and an activity log entry is written.
async function loadNodemailer(): Promise<any | null> {
  try {
    const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>
    const mod = await dynamicImport('nodemailer')
    return mod.default || mod
  } catch {
    return null
  }
}

// POST /api/email/send
// Body: { to, cc?, bcc?, subject, html?, text?, replyTo? }
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

  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const tenantId = await getCurrentTenantId()

  const body = await req.json()
  const { to, cc, bcc, subject, html, text, replyTo } = body || {}
  if (!to || !subject) {
    return NextResponse.json({ error: 'to and subject are required' }, { status: 400 })
  }
  if (!html && !text) {
    return NextResponse.json(
      { error: 'Either html or text body is required' },
      { status: 400 }
    )
  }

  const config =
    (await getBusinessSetting<EmailConfig>(businessId, 'email_config')) || null
  if (!config || !config.enabled || !config.host || !config.fromAddress) {
    return NextResponse.json(
      {
        error:
          'Email not configured. Set up SMTP in Settings → Email first, then enable it.',
      },
      { status: 400 }
    )
  }

  const nodemailer = await loadNodemailer()
  if (!nodemailer) {
    // Degrade gracefully — log the attempt and record an activity entry
    console.warn(
      '[email/send] nodemailer is not installed — recording email attempt without sending.',
      { businessId, to, subject }
    )
    await db.activityLog
      .create({
        data: {
          businessId,
          userId: session.userId,
          entityType: 'EMAIL',
          entityId: businessId,
          action: 'EMAILED',
          message: `Email to ${to} (subject: "${subject}") — NOT sent (nodemailer not installed)`,
          metadata: JSON.stringify({ to, cc, bcc, subject, hasHtml: !!html, hasText: !!text }),
        },
      })
      .catch(() => {})
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        warning: 'nodemailer is not installed — email body was logged but not delivered.',
      },
      { status: 200 }
    )
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.username
        ? { user: config.username, pass: config.password }
        : undefined,
    })

    const info = await transporter.sendMail({
      from: config.fromName
        ? `"${config.fromName}" <${config.fromAddress}>`
        : config.fromAddress,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      replyTo: replyTo || config.replyTo || undefined,
      subject,
      html: html || undefined,
      text: text || undefined,
    })

    // Activity log (best-effort)
    await db.activityLog
      .create({
        data: {
          businessId,
          userId: session.userId,
          entityType: 'EMAIL',
          entityId: businessId,
          action: 'EMAILED',
          message: `Email sent to ${to} (subject: "${subject}")`,
          metadata: JSON.stringify({
            to,
            cc,
            bcc,
            subject,
            messageId: info?.messageId,
          }),
        },
      })
      .catch(() => {})

    // Audit log (best-effort)
    if (tenantId) {
      await db.auditLog
        .create({
          data: {
            businessId,
            tenantId,
            userId: session.userId,
            action: 'EMAIL_SENT',
            entityType: 'EMAIL',
            entityId: info?.messageId || businessId,
            description: `Sent email to ${to} (subject: "${subject}")`,
          },
        })
        .catch(() => {})
    }

    return NextResponse.json({ ok: true, sent: true, messageId: info?.messageId })
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to send email: ${(e as Error).message}` },
      { status: 500 }
    )
  }
}
