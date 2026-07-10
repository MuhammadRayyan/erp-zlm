'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Save } from 'lucide-react'
import { fmtMoney, fmtDate, StatusBadge, LoadingSpinner, EmptyState, useFetch, PageHeader, useBusiness } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Quotation { id: string; number: string; date: string; validUntil: string | null; partyName: string; total: number; status: string; currency: string; lines: { description: string; quantity: number; unitPrice: number; discount: number; lineTotal: number; lineTax: number }[]; notes: string | null; terms: string | null; partyId: string }
interface Party { id: string; name: string }

export function QuotationsModule({ navigate, searchParams }: ModuleProps) {
  const { business } = useBusiness()
  const action = searchParams.get('action')
  if (action === 'new') return <QuotationForm business={business} navigate={navigate} />
  if (action === 'view' && searchParams.get('id')) return <QuotationView business={business} navigate={navigate} id={searchParams.get('id')!} />
  return <QuotationList business={business} navigate={navigate} />
}

function QuotationList({ navigate }: ModuleProps) {
  const { data: quotations, loading } = useFetch<Quotation[]>('/api/quotations')
  if (loading) return <LoadingSpinner message="Loading quotations..." />
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Quotations</h2><p className="text-sm text-muted-foreground">Create quotes and estimates for customers</p></div>
        <Button onClick={() => navigate('quotations', { action: 'new' })}><Plus className="mr-2 h-4 w-4" /> New Quotation</Button>
      </div>
      {!quotations || quotations.length === 0 ? (
        <EmptyState title="No quotations" description="Create your first quotation." action={{ label: 'New Quotation', onClick: () => navigate('quotations', { action: 'new' }) }} />
      ) : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Valid Until</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{quotations.map(q => (
            <TableRow key={q.id} className="cursor-pointer" onClick={() => navigate('quotations', { action: 'view', id: q.id })}>
              <TableCell className="font-medium">{q.number}</TableCell><TableCell>{fmtDate(q.date)}</TableCell><TableCell>{q.partyName}</TableCell>
              <TableCell>{fmtDate(q.validUntil)}</TableCell><TableCell className="text-right font-medium">{fmtMoney(q.total, q.currency)}</TableCell><TableCell><StatusBadge status={q.status} /></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></CardContent></Card>
      )}
    </div>
  )
}

function QuotationForm({ navigate }: ModuleProps) {
  const { business } = useBusiness()
  const { data: parties } = useFetch<Party[]>('/api/parties?type=CUSTOMER')
  const [form, setForm] = React.useState({
    partyId: '', date: new Date().toISOString().split('T')[0], validUntil: '',
    reference: '', notes: '', terms: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: business?.vatRegistered ? Number(business.vatRate) : 0 }],
  })
  const [saving, setSaving] = React.useState(false)
  const vatRate = business?.vatRegistered ? Number(business.vatRate) : 0
  const currency = business?.baseCurrency || 'AED'

  const calcLines = form.lines.map(l => {
    const gross = l.quantity * l.unitPrice
    const net = gross - gross * (l.discount / 100)
    const tax = net * (vatRate / 100)
    return { ...l, lineTotal: net, lineTax: tax }
  })
  const total = calcLines.reduce((s, l) => s + l.lineTotal + l.lineTax, 0)

  const save = async () => {
    if (!form.partyId) { toast.error('Select a customer'); return }
    setSaving(true)
    const res = await fetch('/api/quotations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { const q = await res.json(); toast.success('Quotation created'); navigate('quotations', { action: 'view', id: q.id }) }
    else toast.error('Failed')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Quotation" onBack={() => navigate('quotations')} actions={<Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save</Button>} />
      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Customer *</Label><Select value={form.partyId} onValueChange={v => setForm({ ...form, partyId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Valid Until</Label><Input type="date" value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} /></div>
        </div>
        <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
      </CardContent></Card>
      <Card><CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Line Items</h3>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, { description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: vatRate }] })}><Plus className="mr-1 h-4 w-4" /> Add Line</Button></div>
        <Table><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-28">Price</TableHead><TableHead className="w-20">Disc%</TableHead><TableHead className="w-28 text-right">Amount</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>{calcLines.map((l, i) => (
            <TableRow key={i}>
              <TableCell><Input value={l.description} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], description: e.target.value }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell><Input type="number" step="0.01" value={l.quantity} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], quantity: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell><Input type="number" step="0.01" value={l.unitPrice} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], unitPrice: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell><Input type="number" step="0.01" value={l.discount} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], discount: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell className="text-right font-medium">{fmtMoney(l.lineTotal + l.lineTax, currency)}</TableCell>
              <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })} disabled={form.lines.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        <div className="mt-4 flex justify-end"><div className="w-64"><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-emerald-700 dark:text-emerald-400">{fmtMoney(total, currency)}</span></div></div></div>
      </CardContent></Card>
      <Card><CardContent className="p-5 space-y-3">
        <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
        <div><Label>Terms</Label><Textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={2} /></div>
      </CardContent></Card>
    </div>
  )
}

function QuotationView({ navigate, id }: ModuleProps & { id: string }) {
  const { business } = useBusiness()
  const { data: q, loading } = useFetch<Quotation>(`/api/quotations?id=${id}`, [id])
  if (loading || !q) return <LoadingSpinner message="Loading quotation..." />
  const currency = q.currency || business?.baseCurrency || 'AED'
  return (
    <div className="space-y-6">
      <PageHeader title={`Quotation ${q.number}`} onBack={() => navigate('quotations')} />
      <Card><CardContent className="p-6">
        <div className="flex items-start justify-between border-b pb-4">
          <div><h3 className="text-xl font-bold">{q.partyName}</h3></div>
          <div className="text-right"><h2 className="text-2xl font-bold uppercase">Quotation</h2><p className="font-semibold text-emerald-600">{q.number}</p><p className="text-sm text-muted-foreground">{fmtDate(q.date)}</p><div className="mt-2"><StatusBadge status={q.status} /></div></div>
        </div>
        <Table className="mt-6"><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>{q.lines.map((l, i) => <TableRow key={i}><TableCell>{l.description}</TableCell><TableCell className="text-right">{l.quantity}</TableCell><TableCell className="text-right">{fmtMoney(l.unitPrice, currency)}</TableCell><TableCell className="text-right font-medium">{fmtMoney(l.lineTotal + l.lineTax, currency)}</TableCell></TableRow>)}</TableBody>
        </Table>
        <div className="mt-4 flex justify-end"><div className="w-64"><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-emerald-700 dark:text-emerald-400">{fmtMoney(q.total, currency)}</span></div></div></div>
      </CardContent></Card>
    </div>
  )
}
