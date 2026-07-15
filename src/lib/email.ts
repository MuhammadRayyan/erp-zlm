// ============================================================
// EMAIL LIBRARY — SMTP integration (Google Workspace & generic)
// ============================================================
// Sends transactional email (invoices, statements, etc.) via a
// configured SMTP server. Config is stored in the AppSetting table
// under the key 'email_config' as JSON.
//
// Google Workspace / Gmail quick-start:
//   host: smtp.gmail.com
//   port: 587
//   secure: false  (STARTTLS)
//   user: your-email@yourdomain.com
//   pass: <App Password from https://myaccount.google.com/apppasswords>
// ============================================================

import nodemailer, { type Transporter } from 'nodemailer'
import { db } from './db'

const SETTING_KEY = 'email_config'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean // true for 465, false for 587 (STARTTLS)
  user: string
  pass: string
  fromName: string
  fromEmail: string
  service?: string // optional 'gmail' shortcut
}

export interface PublicEmailConfig extends Omit<EmailConfig, 'pass'> {
  pass: string // masked: '****' or ''
  hasPassword: boolean
}

export interface Attachment {
  filename: string
  content?: string | Buffer
  path?: string
  contentType?: string
  encoding?: string // for string content: 'base64', 'utf-8', etc.
}

export interface SendEmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Attachment[]
  replyTo?: string
}

// In-memory transporter cache so we don't re-create on every send
let cachedTransporter: { configKey: string; transporter: Transporter } | null = null

function configKey(c: EmailConfig): string {
  return `${c.host}:${c.port}:${c.user}:${c.service || ''}`
}

// ----------------------------------------------------------------
// Config persistence
// ----------------------------------------------------------------

/**
 * Read the saved email config from the AppSetting table.
 * Returns null if no config has been saved yet.
 */
export async function getEmailConfig(): Promise<EmailConfig | null> {
  const setting = await db.appSetting.findUnique({ where: { key: SETTING_KEY } })
  if (!setting) return null
  try {
    const parsed = JSON.parse(setting.value) as EmailConfig
    // Basic validation
    if (!parsed.host || !parsed.user) return null
    return {
      host: parsed.host,
      port: Number(parsed.port) || 587,
      secure: parsed.secure ?? (Number(parsed.port) === 465),
      user: parsed.user,
      pass: parsed.pass || '',
      fromName: parsed.fromName || '',
      fromEmail: parsed.fromEmail || parsed.user,
      service: parsed.service,
    }
  } catch {
    return null
  }
}

/**
 * Persist an email config to the AppSetting table.
 * If `pass` is empty / the literal '****' marker, keep the existing password.
 */
export async function saveEmailConfig(config: Partial<EmailConfig>): Promise<EmailConfig> {
  const existing = await getEmailConfig()
  const merged: EmailConfig = {
    host: config.host ?? existing?.host ?? 'smtp.gmail.com',
    port: Number(config.port ?? existing?.port ?? 587),
    secure: config.secure ?? existing?.secure ?? false,
    user: config.user ?? existing?.user ?? '',
    pass: config.pass && config.pass !== '****' ? config.pass : existing?.pass ?? '',
    fromName: config.fromName ?? existing?.fromName ?? '',
    fromEmail: config.fromEmail ?? existing?.fromEmail ?? config.user ?? existing?.user ?? '',
    service: config.service ?? existing?.service,
  }

  await db.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(merged) },
    create: { id: `email_config_${Date.now()}`, key: SETTING_KEY, value: JSON.stringify(merged) },
  })

  // Invalidate cache so next send uses fresh credentials
  cachedTransporter = null
  return merged
}

/**
 * Return a public-safe config (password masked) for API responses.
 */
export function maskConfig(config: EmailConfig | null): PublicEmailConfig | null {
  if (!config) {
    return {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      fromName: '',
      fromEmail: '',
      hasPassword: false,
    }
  }
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: config.pass ? '****' : '',
    fromName: config.fromName,
    fromEmail: config.fromEmail,
    service: config.service,
    hasPassword: !!config.pass,
  }
}

// ----------------------------------------------------------------
// Transporter creation & testing
// ----------------------------------------------------------------

/**
 * Build a nodemailer transporter from a config.
 * Detects Google Workspace / Gmail and uses the `service: 'gmail'` shortcut
 * when host matches smtp.gmail.com (more reliable than raw host/port for OAuth
 * fallbacks), but falls back to plain SMTP for generic servers.
 */
export function createTransporter(config: EmailConfig): Transporter {
  const isGmail = config.service === 'gmail' ||
    /smtp\.gmail\.com$/i.test(config.host)

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.user, pass: config.pass },
    } as nodemailer.TransportOptions)
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  } as nodemailer.TransportOptions)
}

/**
 * Verify the SMTP connection. Resolves true on success, throws on failure.
 */
export async function testEmailConfig(config: EmailConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = createTransporter(config)
    await transporter.verify()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

/**
 * Get or create a transporter from the saved config. Throws if not configured.
 */
async function getTransporter(): Promise<{ transporter: Transporter; config: EmailConfig }> {
  const config = await getEmailConfig()
  if (!config || !config.user || !config.pass) {
    throw new Error('Email not configured. Go to System → Email → Configuration to set up SMTP.')
  }

  const key = configKey(config)
  if (cachedTransporter && cachedTransporter.configKey === key) {
    return { transporter: cachedTransporter.transporter, config }
  }

  const transporter = createTransporter(config)
  cachedTransporter = { configKey: key, transporter }
  return { transporter, config }
}

// ----------------------------------------------------------------
// Sending
// ----------------------------------------------------------------

/**
 * Send an email via the configured SMTP server.
 * Throws on failure — callers should try/catch and return a friendly error.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ messageId: string; response: string }> {
  const { transporter, config } = await getTransporter()

  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail || config.user}>`
    : (config.fromEmail || config.user)

  const info = await transporter.sendMail({
    from,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
    bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: (options.attachments || []).map(a => ({
      filename: a.filename,
      content: a.content,
      path: a.path,
      contentType: a.contentType,
      encoding: a.encoding as 'base64' | 'utf-8' | 'binary' | 'hex' | undefined,
    })),
  })

  return { messageId: info.messageId, response: info.response }
}

/**
 * Convenience: build a simple HTML wrapper around a plain-text body.
 */
export function htmlFromText(text: string): string {
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; white-space: pre-wrap;">${escapeHtml(text)}</div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
