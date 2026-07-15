'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Save, Send, Mail, CheckCircle2, AlertCircle, Info, RefreshCw, Inbox } from 'lucide-react'
import { useFetch, LoadingSpinner, useBusiness, fmtDate } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  fromName: string
  fromEmail: string
  service?: string
  hasPassword: boolean
}

interface ActivityEntry {
  id: string
  userName: string
  action: string
  message: string
  entityType: string
  entityId: string
  createdAt: string
  metadata: string | null
}

export function EmailSettingsModule(_props: ModuleProps) {
  const { business } = useBusiness()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mail className="h-6 w-6 text-emerald-600" />
          Email
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure SMTP to send invoices, statements, and other emails from {business?.name || 'your business'}.
        </p>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-2">
          <TabsTrigger value="config"><Mail className="mr-2 h-4 w-4" />Email Configuration</TabsTrigger>
          <TabsTrigger value="compose"><Send className="mr-2 h-4 w-4" />Compose Email</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <EmailConfigTab />
        </TabsContent>

        <TabsContent value="compose" className="space-y-4">
          <ComposeTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// Tab 1: Configuration
// ============================================================
function EmailConfigTab() {
  const { data: config, loading, refetch } = useFetch<EmailConfig>('/api/email/config')
  const [form, setForm] = React.useState<Partial<EmailConfig> | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [testTo, setTestTo] = React.useState('')

  React.useEffect(() => {
    if (config && !form) {
      setForm({
        host: config.host || 'smtp.gmail.com',
        port: config.port || 587,
        secure: config.secure ?? false,
        user: config.user || '',
        pass: config.hasPassword ? '****' : '',
        fromName: config.fromName || '',
        fromEmail: config.fromEmail || '',
      })
      setTestTo(config.user || '')
    }
  }, [config, form])

  if (loading || !form) return <LoadingSpinner message="Loading email config..." />

  const isGmail = (form.host || '').includes('gmail.com')

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'save' }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Email configuration saved')
        refetch()
      } else {
        toast.error(data.error || 'Failed to save')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action: 'test', testTo }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Test email sent to ${data.sentTo || testTo}`)
      } else {
        toast.error(data.error || 'Test failed')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>SMTP Configuration</span>
            {config?.hasPassword ? (
              <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Configured</Badge>
            ) : (
              <Badge variant="outline"><AlertCircle className="mr-1 h-3 w-3" />Not Configured</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>SMTP Host</Label>
              <Input
                value={form.host || ''}
                onChange={e => setForm({ ...form, host: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label>SMTP Port</Label>
              <Input
                type="number"
                value={form.port || 587}
                onChange={e => setForm({ ...form, port: parseInt(e.target.value) || 587, secure: (parseInt(e.target.value) || 587) === 465 })}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Username (email address)</Label>
              <Input
                type="email"
                value={form.user || ''}
                onChange={e => setForm({ ...form, user: e.target.value })}
                placeholder="you@yourdomain.com"
              />
            </div>
            <div>
              <Label>Password {config?.hasPassword && <span className="text-xs text-muted-foreground">(leave as **** to keep current)</span>}</Label>
              <Input
                type="password"
                value={form.pass || ''}
                onChange={e => setForm({ ...form, pass: e.target.value })}
                placeholder={config?.hasPassword ? '••••••••' : 'App password'}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>From Name</Label>
              <Input
                value={form.fromName || ''}
                onChange={e => setForm({ ...form, fromName: e.target.value })}
                placeholder="Your Company Name"
              />
            </div>
            <div>
              <Label>From Email</Label>
              <Input
                type="email"
                value={form.fromEmail || ''}
                onChange={e => setForm({ ...form, fromEmail: e.target.value })}
                placeholder="you@yourdomain.com"
              />
            </div>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div className="text-sm text-emerald-900 dark:text-emerald-200">
                <p className="font-semibold">{isGmail ? 'Google Workspace / Gmail Setup' : 'SMTP Setup'}</p>
                {isGmail ? (
                  <ul className="mt-1 list-disc pl-5 text-xs space-y-1 text-emerald-800 dark:text-emerald-300">
                    <li>For Google Workspace, use <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900">smtp.gmail.com:587</code></li>
                    <li>Username: your <code className="rounded bg-emerald-100 px-1 dark:bg-emerald-900">email@yourdomain.com</code></li>
                    <li>Password: your <strong>App Password</strong> (not your regular password)</li>
                    <li>Enable 2FA and generate an App Password at{' '}
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline">
                        myaccount.google.com/apppasswords
                      </a>
                    </li>
                  </ul>
                ) : (
                  <p className="mt-1 text-xs">Contact your email provider for the SMTP host, port, and credentials.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-end md:justify-between">
            <div className="flex-1 max-w-sm">
              <Label>Send test email to</Label>
              <Input
                type="email"
                value={testTo}
                onChange={e => setTestTo(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={test} disabled={testing || !testTo}>
                {testing ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Testing...</> : <><Send className="mr-2 h-4 w-4" />Test Connection</>}
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />Save Configuration</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

// ============================================================
// Tab 2: Compose
// ============================================================
function ComposeTab() {
  const [to, setTo] = React.useState('')
  const [cc, setCc] = React.useState('')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const { data: recentEmails, loading: loadingRecent, refetch } = useFetch<ActivityEntry[]>('/api/activity?action=EMAILED&limit=10')

  const send = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('To, Subject, and Body are all required')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc: cc || undefined, subject, body, isHtml: false }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Email sent')
        setTo(''); setCc(''); setSubject(''); setBody('')
        refetch()
      } else {
        toast.error(data.error || 'Failed to send email')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Compose Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>To</Label>
              <Input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" />
            </div>
            <div>
              <Label>CC (optional)</Label>
              <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" />
            </div>
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject..." />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Type your message..." />
          </div>
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending}>
              {sending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send Email</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            Recently Sent
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecent ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading...</div>
          ) : !recentEmails || recentEmails.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No emails sent yet.</div>
          ) : (
            <ul className="space-y-2">
              {recentEmails.map(a => {
                let toAddr = ''
                let subj = ''
                try {
                  const m = a.metadata ? JSON.parse(a.metadata) : null
                  toAddr = m?.to || ''
                  subj = m?.subject || ''
                } catch { /* ignore */ }
                return (
                  <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">EMAILED</Badge>
                        <span className="truncate text-sm font-medium">{subj || a.message}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        To: {toAddr || '—'} · By {a.userName}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(a.createdAt)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
