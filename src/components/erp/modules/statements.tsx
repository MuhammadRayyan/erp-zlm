'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Mail, Printer, Send } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, PageHeader } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Party {
  id: string
  name: string
  type: string
  email: string | null
  trn: string | null
  phone: string | null
}

interface StatementRow {
  date: string
  type: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
}

interface StatementData {
  business: {
    name: string
    legalName: string | null
    trn: string | null
    email: string | null
    phone: string | null
    addressLine1: string | null
    city: string | null
    country: string
    baseCurrency: string
  } | null
  party: {
    id: string
    name: string
    type: string
    trn: string | null
    email: string | null
    phone: string | null
  }
  currency: string
  startDate: string
  endDate: string
  openingBalance: number
  closingBalance: number
  totalDebit: number
  totalCredit: number
  transactions: StatementRow[]
  aging: {
    current: number
    days30: number
    days60: number
    days90: number
    over90: number
    total: number
  }
}

export function StatementsModule({ }: ModuleProps) {
  const [partyType, setPartyType] = React.useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER')
  const { data: parties, loading: partiesLoading } = useFetchParties(partyType)
  const [partyId, setPartyId] = React.useState('')
  const [startDate, setStartDate] = React.useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0])
  const [statement, setStatement] = React.useState<StatementData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [emailOpen, setEmailOpen] = React.useState(false)

  const generate = async () => {
    if (!partyId) { toast.error('Select a party'); return }
    setLoading(true)
    setStatement(null)
    try {
      const res = await fetch(`/api/statements?partyId=${partyId}&startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setStatement(data as StatementData)
    } finally {
      setLoading(false)
    }
  }

  const openPreview = () => {
    if (!partyId) return
    const url = `/api/statements/preview?partyId=${partyId}&startDate=${startDate}&endDate=${endDate}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer & Supplier Statements"
        description="Generate account statements with opening balance, transactions, and aging summary"
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5 md:items-end">
            <div>
              <Label>Party Type</Label>
              <Select value={partyType} onValueChange={(v) => { setPartyType(v as 'CUSTOMER' | 'SUPPLIER'); setPartyId(''); setStatement(null) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="SUPPLIER">Supplier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Party</Label>
              {partiesLoading ? (
                <Select disabled><SelectTrigger><SelectValue placeholder="Loading..." /></SelectTrigger></Select>
              ) : (
                <Select value={partyId} onValueChange={setPartyId}>
                  <SelectTrigger><SelectValue placeholder={`Select ${partyType.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent>
                    {(parties || []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={openPreview} disabled={!partyId}>
              <Printer className="mr-2 h-4 w-4" /> Print Preview
            </Button>
            <Button variant="outline" onClick={() => setEmailOpen(true)} disabled={!statement}>
              <Mail className="mr-2 h-4 w-4" /> Email
            </Button>
            <Button onClick={generate} disabled={loading || !partyId}>
              <FileText className="mr-2 h-4 w-4" /> {loading ? 'Generating...' : 'Generate Statement'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <LoadingSpinner message="Generating statement..." />}

      {!loading && !statement && (
        <EmptyState
          title="No statement generated"
          description="Select a party and date range above, then click Generate Statement."
        />
      )}

      {statement && (
        <StatementView data={statement} />
      )}

      {emailOpen && statement && (
        <EmailStatementDialog
          party={statement.party}
          businessName={statement.business?.name || ''}
          startDate={statement.startDate}
          endDate={statement.endDate}
          onClose={() => setEmailOpen(false)}
          partyId={partyId}
          dateRange={{ startDate, endDate }}
        />
      )}
    </div>
  )
}

function useFetchParties(type: 'CUSTOMER' | 'SUPPLIER') {
  const [data, setData] = React.useState<Party[] | null>(null)
  const [loading, setLoading] = React.useState(true)
  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/parties?type=${type}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setData(d as Party[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [type])
  return { data, loading }
}

function StatementView({ data }: { data: StatementData }) {
  const isCustomer = data.party.type === 'CUSTOMER' || data.party.type === 'BOTH'
  const balanceLabel = data.closingBalance >= 0
    ? (isCustomer ? 'Balance Due' : 'You Owe')
    : (isCustomer ? 'Credit Available' : 'Balance Due to You')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Opening Balance</p>
          <p className="text-lg font-bold">{fmtMoney(data.openingBalance, data.currency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Debits</p>
          <p className="text-lg font-bold text-emerald-600">{fmtMoney(data.totalDebit, data.currency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Credits</p>
          <p className="text-lg font-bold text-red-600">{fmtMoney(data.totalCredit, data.currency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">{balanceLabel}</p>
          <p className="text-lg font-bold">{fmtMoney(Math.abs(data.closingBalance), data.currency)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={6}>Opening Balance ({fmtDate(data.startDate)})</TableCell>
                <TableCell className="text-right">{fmtMoney(data.openingBalance, data.currency)}</TableCell>
              </TableRow>
              {data.transactions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No transactions in this period</TableCell></TableRow>
              ) : data.transactions.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs whitespace-nowrap">{fmtDate(t.date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{t.type.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                  <TableCell className="text-xs">{t.description}</TableCell>
                  <TableCell className="text-right text-xs">{t.debit > 0 ? fmtMoney(t.debit, data.currency) : '—'}</TableCell>
                  <TableCell className="text-right text-xs">{t.credit > 0 ? fmtMoney(t.credit, data.currency) : '—'}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{fmtMoney(t.balance, data.currency)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-bold">
                <TableCell colSpan={4}>Closing Balance ({fmtDate(data.endDate)})</TableCell>
                <TableCell className="text-right">{fmtMoney(data.totalDebit, data.currency)}</TableCell>
                <TableCell className="text-right">{fmtMoney(data.totalCredit, data.currency)}</TableCell>
                <TableCell className="text-right">{fmtMoney(data.closingBalance, data.currency)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data.aging.total > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Aging Summary</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: 'Current', value: data.aging.current },
                  { label: '1-30 days', value: data.aging.days30 },
                  { label: '31-60 days', value: data.aging.days60 },
                  { label: '61-90 days', value: data.aging.days90 },
                  { label: 'Over 90 days', value: data.aging.over90 },
                ].map((a) => (
                  <TableRow key={a.label}>
                    <TableCell>{a.label}</TableCell>
                    <TableCell className="text-right">{fmtMoney(a.value, data.currency)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {data.aging.total > 0 ? ((a.value / data.aging.total) * 100).toFixed(1) : '0.0'}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell>Total Outstanding</TableCell>
                  <TableCell className="text-right">{fmtMoney(data.aging.total, data.currency)}</TableCell>
                  <TableCell className="text-right text-xs">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EmailStatementDialog({
  party,
  businessName,
  startDate,
  endDate,
  onClose,
  partyId,
  dateRange,
}: {
  party: { id: string; name: string; email: string | null }
  businessName: string
  startDate: string
  endDate: string
  onClose: () => void
  partyId: string
  dateRange: { startDate: string; endDate: string }
}) {
  const [to, setTo] = React.useState(party.email || '')
  const [subject, setSubject] = React.useState(`Account Statement from ${businessName}`)
  const [message, setMessage] = React.useState(
    `Dear ${party.name},\n\nPlease find attached your account statement for the period ${fmtDate(startDate)} to ${fmtDate(endDate)}.\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\n${businessName}`,
  )
  const [sending, setSending] = React.useState(false)

  const send = async () => {
    if (!to.trim()) { toast.error('Recipient email is required'); return }
    setSending(true)
    try {
      // Fetch the HTML preview to attach
      const previewRes = await fetch(
        `/api/statements/preview?partyId=${partyId}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
      )
      const html = await previewRes.text()

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;max-width:700px;margin:0 auto;">
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;">
            <p style="color:#6b7280;font-size:12px;">Your full statement is included below for your records.</p>
            <div style="margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">${html}</div>
          </div>`,
          isHtml: true,
          attachments: [
            {
              filename: `Statement-${party.name.replace(/[^a-zA-Z0-9]/g, '_')}-${dateRange.startDate}.html`,
              content: html,
              contentType: 'text/html',
            },
          ],
          entityType: 'PARTY',
          entityId: party.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to send'); return }
      toast.success(`Statement emailed to ${to}`)
      onClose()
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Email Statement</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>To *</Label>
            <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@example.com" />
            {!party.email && <p className="mt-1 text-xs text-amber-600">No email on file for this party.</p>}
          </div>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            The full statement HTML will be embedded in the email and attached as an .html file.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={sending || !to.trim()}>
            <Send className="mr-2 h-4 w-4" /> {sending ? 'Sending...' : 'Send Statement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
