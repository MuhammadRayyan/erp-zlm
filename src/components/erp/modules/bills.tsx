'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Save, Send, ArrowLeft, Search } from 'lucide-react'
import { fmtMoney, fmtDate, fmtNumber, StatusBadge, LoadingSpinner, EmptyState, useFetch, PageHeader } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Bill {
  id: string; number: string; date: string; dueDate: string; partyId: string; partyName: string
  supplierInvoiceNumber: string | null; reference: string | null
  subtotal: number; totalTax: number; total: number; amountPaid: number; balanceDue: number
  status: string; currency: string; notes: string | null
  lines: { id?: string; description: string; quantity: number; unitPrice: number; discount: number; taxRateId?: string | null; taxRate?: { rate: number } | null; lineTotal: number; lineTax: number }[]
}
interface Party { id: string; name: string }
interface TaxRate { id: string; name: string; rate: number }

export function BillsModule({ business, navigate, searchParams }: ModuleProps) {
  const action = searchParams.get('action')
  const editId = searchParams.get('id')
  if (action === 'new') return <BillForm business={business} navigate={navigate} />
  if (action === 'view' && editId) return <BillView business={business} navigate={navigate} id={editId} />
  return <BillList business={business} navigate={navigate} />
}

function BillList({ navigate }: ModuleProps) {
  const { data: bills, loading } = useFetch<Bill[]>('/api/bills')
  const [search, setSearch] = React.useState('')
  if (loading) return <LoadingSpinner message="Loading bills..." />
  const filtered = (bills || []).filter(b => b.number.toLowerCase().includes(search.toLowerCase()) || b.partyName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Purchase Bills</h2><p className="text-sm text-muted-foreground">Record supplier bills with input VAT</p></div>
        <Button onClick={() => navigate('bills', { action: 'new' })}><Plus className="mr-2 h-4 w-4" /> New Bill</Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No bills" description="Record your first purchase bill." action={{ label: 'New Bill', onClick: () => navigate('bills', { action: 'new' }) }} />
      ) : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
              <TableHead>Supplier Inv #</TableHead><TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(b => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => navigate('bills', { action: 'view', id: b.id })}>
                  <TableCell className="font-medium">{b.number}</TableCell>
                  <TableCell>{fmtDate(b.date)}</TableCell>
                  <TableCell>{b.partyName}</TableCell>
                  <TableCell>{b.supplierInvoiceNumber || '—'}</TableCell>
                  <TableCell>{fmtDate(b.dueDate)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMoney(b.total, b.currency)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(b.balanceDue, b.currency)}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  )
}

function BillForm({ business, navigate }: ModuleProps) {
  const { data: parties } = useFetch<Party[]>('/api/parties?type=SUPPLIER')
  const { data: taxRates } = useFetch<TaxRate[]>('/api/tax-rates')
  const [form, setForm] = React.useState({
    partyId: '', date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    supplierInvoiceNumber: '', reference: '', notes: '',
    lines: [{ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: business?.vatRegistered ? Number(business.vatRate) : 0 }],
  })
  const [saving, setSaving] = React.useState(false)

  const vatRate = business?.vatRegistered ? Number(business.vatRate) : 0
  const currency = business?.baseCurrency || 'AED'

  const calcLines = form.lines.map(l => {
    const gross = l.quantity * l.unitPrice
    const net = gross - gross * (l.discount / 100)
    const tax = net * ((l.taxRate ?? vatRate) / 100)
    return { ...l, lineTotal: net, lineTax: tax }
  })
  const subtotal = calcLines.reduce((s, l) => s + l.lineTotal, 0)
  const totalTax = calcLines.reduce((s, l) => s + l.lineTax, 0)
  const total = subtotal + totalTax

  const save = async (post: boolean) => {
    if (!form.partyId) { toast.error('Select a supplier'); return }
    setSaving(true)
    const res = await fetch('/api/bills', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, post, lines: form.lines.map(l => ({ ...l, taxRateId: l.taxRateId, taxRate: l.taxRate ?? vatRate })) }),
    })
    if (res.ok) { const b = await res.json(); toast.success(post ? 'Bill posted' : 'Bill saved'); navigate('bills', { action: 'view', id: b.id }) }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Purchase Bill" onBack={() => navigate('bills')}
        actions={<><Button variant="outline" onClick={() => save(false)}><Save className="mr-2 h-4 w-4" /> Save Draft</Button><Button onClick={() => save(true)}><Send className="mr-2 h-4 w-4" /> Save & Post</Button></>} />
      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Supplier *</Label><Select value={form.partyId} onValueChange={v => setForm({ ...form, partyId: v })}><SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger><SelectContent>{parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Supplier Invoice #</Label><Input value={form.supplierInvoiceNumber} onChange={e => setForm({ ...form, supplierInvoiceNumber: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Bill Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
          <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Line Items</h3>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, { description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: vatRate }] })}><Plus className="mr-1 h-4 w-4" /> Add Line</Button></div>
        <Table>
          <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-28">Price</TableHead><TableHead className="w-20">Disc%</TableHead><TableHead className="w-28">Tax</TableHead><TableHead className="w-28 text-right">Amount</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>
            {calcLines.map((l, i) => (
              <TableRow key={i}>
                <TableCell><Input value={l.description} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], description: e.target.value }; setForm({ ...form, lines }) }} /></TableCell>
                <TableCell><Input type="number" step="0.01" value={l.quantity} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], quantity: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
                <TableCell><Input type="number" step="0.01" value={l.unitPrice} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], unitPrice: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
                <TableCell><Input type="number" step="0.01" value={l.discount} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], discount: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
                <TableCell><Select value={l.taxRateId || `_rate_${l.taxRate}`} onValueChange={v => { if (v.startsWith('_rate_')) { const lines = [...form.lines]; lines[i] = { ...lines[i], taxRate: parseFloat(v.replace('_rate_', '')), taxRateId: undefined }; setForm({ ...form, lines }) } else { const tr = taxRates?.find(t => t.id === v); const lines = [...form.lines]; lines[i] = { ...lines[i], taxRateId: v, taxRate: tr?.rate }; setForm({ ...form, lines }) } }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={`_rate_${vatRate}`}>VAT {vatRate}%</SelectItem><SelectItem value="_rate_0">No Tax</SelectItem>{taxRates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></TableCell>
                <TableCell className="text-right font-medium">{fmtMoney(l.lineTotal + l.lineTax, currency)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })} disabled={form.lines.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 flex justify-end"><div className="w-64 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmtMoney(subtotal, currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT</span><span>{fmtMoney(totalTax, currency)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-emerald-700 dark:text-emerald-400">{fmtMoney(total, currency)}</span></div>
        </div></div>
      </CardContent></Card>
      <Card><CardContent className="p-5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></CardContent></Card>
    </div>
  )
}

function BillView({ business, navigate, id }: ModuleProps & { id: string }) {
  const { data: bill, loading } = useFetch<Bill>(`/api/bills?id=${id}`, [id])
  if (loading || !bill) return <LoadingSpinner message="Loading bill..." />
  const currency = bill.currency || business?.baseCurrency || 'AED'

  const handlePost = async () => {
    const res = await fetch('/api/bills/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'post', id }) })
    if (res.ok) { toast.success('Bill posted'); window.location.reload() }
    else toast.error('Failed')
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Bill ${bill.number}`} onBack={() => navigate('bills')}
        actions={bill.status === 'DRAFT' ? <Button onClick={handlePost}><Send className="mr-2 h-4 w-4" /> Post</Button> : undefined} />
      <Card><CardContent className="p-6">
        <div className="flex items-start justify-between border-b pb-4">
          <div><h3 className="text-xl font-bold">{bill.partyName}</h3>{bill.supplierInvoiceNumber && <p className="text-sm text-muted-foreground">Supplier Inv: {bill.supplierInvoiceNumber}</p>}</div>
          <div className="text-right"><h2 className="text-2xl font-bold uppercase">Bill</h2><p className="font-semibold text-emerald-600">{bill.number}</p><p className="text-sm text-muted-foreground">{fmtDate(bill.date)}</p><div className="mt-2"><StatusBadge status={bill.status} /></div></div>
        </div>
        <Table className="mt-6">
          <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>{bill.lines.map((l, i) => <TableRow key={i}><TableCell>{l.description}</TableCell><TableCell className="text-right">{fmtNumber(l.quantity)}</TableCell><TableCell className="text-right">{fmtMoney(l.unitPrice, currency)}</TableCell><TableCell className="text-right font-medium">{fmtMoney(l.lineTotal + l.lineTax, currency)}</TableCell></TableRow>)}</TableBody>
        </Table>
        <div className="mt-4 flex justify-end"><div className="w-64 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmtMoney(bill.subtotal, currency)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT</span><span>{fmtMoney(bill.totalTax, currency)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-emerald-700 dark:text-emerald-400">{fmtMoney(bill.total, currency)}</span></div>
        </div></div>
        {bill.notes && <div className="mt-4 rounded-lg bg-muted p-3 text-sm">{bill.notes}</div>}
      </CardContent></Card>
    </div>
  )
}
