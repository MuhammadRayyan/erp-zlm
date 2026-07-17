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
import { PdfPreview } from './invoices'
import { Printer, Send } from 'lucide-react'

export function CreditNotesModule({ navigate, searchParams }: ModuleProps) {
  const { business } = useBusiness()
  const action = searchParams.get('action')
  if (action === 'new' || action === 'edit') return <CreditNoteForm business={business} navigate={navigate} editId={action === 'edit' ? searchParams.get('id') : undefined} />
  if (action === 'view' && searchParams.get('id')) return <CreditNoteView business={business} navigate={navigate} id={searchParams.get('id')!} />
  return <CreditNoteList business={business} navigate={navigate} />
}

function CreditNoteList({ navigate }: any) {
  const { data: cns, loading } = useFetch<{ id: string; number: string; date: string; partyName: string; total: number; status: string; reason: string | null }[]>('/api/credit-notes')
  if (loading) return <LoadingSpinner message="Loading credit notes..." />
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Credit Notes</h2><p className="text-sm text-muted-foreground">Issue credit notes to customers for returns or adjustments</p></div>
        <Button onClick={() => navigate('credit-notes', { action: 'new' })}><Plus className="mr-2 h-4 w-4" /> New Credit Note</Button>
      </div>
      {!cns || cns.length === 0 ? <EmptyState title="No credit notes" description="Create a credit note to refund or adjust an invoice." action={{ label: 'New Credit Note', onClick: () => navigate('credit-notes', { action: 'new' }) }} /> : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{cns.map(c => <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate('credit-notes', { action: 'view', id: c.id })}><TableCell className="font-medium">{c.number}</TableCell><TableCell>{fmtDate(c.date)}</TableCell><TableCell>{c.partyName}</TableCell><TableCell>{c.reason || '—'}</TableCell><TableCell className="text-right font-medium">{fmtMoney(c.total)}</TableCell><TableCell><StatusBadge status={c.status} /></TableCell></TableRow>)}</TableBody>
        </Table></CardContent></Card>
      )}
    </div>
  )
}

function CreditNoteForm({ navigate, editId }: any & { editId?: string }) {
  const { business } = useBusiness()
  const { data: parties } = useFetch<{ id: string; name: string }[]>('/api/parties?type=CUSTOMER')
  const { data: editCn } = useFetch<any>(editId ? `/api/credit-notes?id=${editId}` : '', [editId])
  
  const [form, setForm] = React.useState<{
    partyId: string; date: string; reason: string; notes: string;
    lines: { description: string; quantity: number; unitPrice: number; discount: number; taxRate: number }[]
  } | null>(null)

  React.useEffect(() => {
    if (editId && editCn) {
      setForm({
        partyId: editCn.partyId, date: editCn.date.split('T')[0], reason: editCn.reason || '', notes: editCn.notes || '',
        lines: editCn.lines.map((l: any) => ({
          description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount,
          taxRate: l.taxRate?.rate || (business?.vatRegistered ? Number(business.vatRate) : 0),
        })),
      })
    } else if (!editId && !form) {
      setForm({
        partyId: '', date: new Date().toISOString().split('T')[0], reason: '', notes: '',
        lines: [{ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: business?.vatRegistered ? Number(business.vatRate) : 0 }],
      })
    }
  }, [editId, editCn, business, form])
  const [saving, setSaving] = React.useState(false)
  if (editId && !editCn) return <LoadingSpinner message="Loading credit note..." />
  if (!form) return <LoadingSpinner />

  const vatRate = business?.vatRegistered ? Number(business.vatRate) : 0
  const currency = business?.baseCurrency || 'AED'
  const calcLines = form.lines.map(l => {
    const gross = l.quantity * l.unitPrice
    const net = gross - gross * (l.discount / 100)
    return { ...l, lineTotal: net, lineTax: net * (vatRate / 100) }
  })
  const total = calcLines.reduce((s, l) => s + l.lineTotal + l.lineTax, 0)

  const save = async (post: boolean) => {
    if (!form.partyId) { toast.error('Select a customer'); return }
    setSaving(true)
    const url = editId ? `/api/credit-notes?id=${editId}` : '/api/credit-notes'
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, post }) })
    if (res.ok) { 
      const cn = await res.json()
      toast.success(`Credit note ${editId ? 'updated' : 'created'}`)
      navigate('credit-notes', { action: 'view', id: cn.id })
    }
    else toast.error('Failed')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={editId ? "Edit Credit Note" : "New Credit Note"} onBack={() => navigate('credit-notes')} actions={<><Button variant="outline" onClick={() => save(false)} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save Draft</Button><Button onClick={() => save(true)} disabled={saving}>Save & Post</Button></>} />
      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Customer *</Label><Select value={form.partyId} onValueChange={v => setForm({ ...form, partyId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        </div>
        <div><Label>Reason</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Return, damaged goods, price adjustment..." /></div>
      </CardContent></Card>
      <Card><CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Line Items</h3>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, { description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: vatRate }] })}><Plus className="mr-1 h-4 w-4" /> Add Line</Button></div>
        <Table><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="w-20">Qty</TableHead><TableHead className="w-28">Price</TableHead><TableHead className="w-28 text-right">Amount</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>{calcLines.map((l, i) => (
            <TableRow key={i}>
              <TableCell><Input value={l.description} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], description: e.target.value }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell><Input type="number" step="0.01" value={l.quantity} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], quantity: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell><Input type="number" step="0.01" value={l.unitPrice} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], unitPrice: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell className="text-right font-medium">{fmtMoney(l.lineTotal + l.lineTax, currency)}</TableCell>
              <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })} disabled={form.lines.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        <div className="mt-4 flex justify-end"><div className="w-64"><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-red-600">-{fmtMoney(total, currency)}</span></div></div></div>
      </CardContent></Card>
    </div>
  )
}

function CreditNoteView({ navigate, id }: any & { id: string }) {
  const { business } = useBusiness()
  const { data: cn, loading } = useFetch<any>(`/api/credit-notes?id=${id}`, [id])
  const [showPdf, setShowPdf] = React.useState(false)

  if (loading || !cn) return <LoadingSpinner message="Loading credit note..." />
  const currency = cn.currency || business?.baseCurrency || 'AED'

  const handlePost = async () => {
    const res = await fetch('/api/credit-notes/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'post', id }) })
    if (res.ok) { toast.success('Posted'); window.location.reload() }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Credit Note ${cn.number}`} 
        onBack={() => navigate('credit-notes')} 
        actions={
          <>
            <Button variant="outline" onClick={() => setShowPdf(!showPdf)}><Printer className="mr-2 h-4 w-4" /> {showPdf ? 'Hide Preview' : 'Preview PDF'}</Button>
            {cn.status === 'DRAFT' && <Button variant="outline" onClick={() => navigate('credit-notes', { action: 'edit', id })}>Edit</Button>}
            {cn.status === 'DRAFT' && <Button onClick={handlePost}><Send className="mr-2 h-4 w-4" /> Post</Button>}
          </>
        }
      />
      {showPdf ? (
        <PdfPreview doctype="CREDIT_NOTE" documentId={id} />
      ) : (
        <Card><CardContent className="p-6">
          <div className="flex items-start justify-between border-b pb-4">
            <div><h3 className="text-xl font-bold">{cn.partyName}</h3></div>
            <div className="text-right"><h2 className="text-2xl font-bold uppercase">Credit Note</h2><p className="font-semibold text-emerald-600">{cn.number}</p><p className="text-sm text-muted-foreground">{fmtDate(cn.date)}</p><div className="mt-2"><StatusBadge status={cn.status} /></div></div>
          </div>
          <Table className="mt-6"><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{cn.lines.map((l: any, i: number) => <TableRow key={i}><TableCell>{l.description}</TableCell><TableCell className="text-right">{l.quantity}</TableCell><TableCell className="text-right">{fmtMoney(l.unitPrice, currency)}</TableCell><TableCell className="text-right font-medium">{fmtMoney(l.lineTotal + l.lineTax, currency)}</TableCell></TableRow>)}</TableBody>
          </Table>
          <div className="mt-4 flex justify-end"><div className="w-64"><div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-red-600">-{fmtMoney(cn.total, currency)}</span></div></div></div>
        </CardContent></Card>
      )}
    </div>
  )
}
