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
import { fmtDate, StatusBadge, LoadingSpinner, EmptyState, useFetch, PageHeader } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'
import { PdfPreview } from './invoices'
import { Printer, Send } from 'lucide-react'

export function DeliveryNotesModule({ navigate, searchParams }: ModuleProps) {
  const action = searchParams.get('action')
  if (action === 'new' || action === 'edit') return <DeliveryNoteForm navigate={navigate} editId={action === 'edit' ? searchParams.get('id') : undefined} />
  if (action === 'view' && searchParams.get('id')) return <DeliveryNoteView navigate={navigate} id={searchParams.get('id')!} />
  return <DeliveryNoteList navigate={navigate} />
}

function DeliveryNoteList({ navigate }: any) {
  const { data: dns, loading } = useFetch<{ id: string; number: string; date: string; partyName: string; status: string }[]>('/api/delivery-notes')
  if (loading) return <LoadingSpinner message="Loading delivery notes..." />
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Delivery Notes</h2><p className="text-sm text-muted-foreground">Track goods delivered to customers</p></div>
        <Button onClick={() => navigate('delivery-notes', { action: 'new' })}><Plus className="mr-2 h-4 w-4" /> New Delivery Note</Button>
      </div>
      {!dns || dns.length === 0 ? <EmptyState title="No delivery notes" description="Create a delivery note to track goods dispatched." action={{ label: 'New Delivery Note', onClick: () => navigate('delivery-notes', { action: 'new' }) }} /> : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{dns.map(d => <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate('delivery-notes', { action: 'view', id: d.id })}><TableCell className="font-medium">{d.number}</TableCell><TableCell>{fmtDate(d.date)}</TableCell><TableCell>{d.partyName}</TableCell><TableCell><StatusBadge status={d.status} /></TableCell></TableRow>)}</TableBody>
        </Table></CardContent></Card>
      )}
    </div>
  )
}

function DeliveryNoteForm({ navigate, editId }: any & { editId?: string }) {
  const { data: parties } = useFetch<{ id: string; name: string }[]>('/api/parties?type=CUSTOMER')
  const { data: items } = useFetch<{ id: string; name: string; sku: string; description: string | null }[]>('/api/items')
  const { data: editDn } = useFetch<any>(editId ? `/api/delivery-notes?id=${editId}` : '', [editId])

  const [form, setForm] = React.useState<{
    partyId: string; date: string; reference: string; notes: string;
    lines: { description: string; quantity: number; itemId: string }[]
  } | null>(null)

  React.useEffect(() => {
    if (editId && editDn) {
      setForm({
        partyId: editDn.partyId, date: editDn.date.split('T')[0], reference: editDn.reference || '', notes: editDn.notes || '',
        lines: editDn.lines.map((l: any) => ({
          description: l.description, quantity: l.quantity, itemId: l.itemId || '',
        })),
      })
    } else if (!editId && !form) {
      setForm({
        partyId: '', date: new Date().toISOString().split('T')[0], reference: '', notes: '',
        lines: [{ description: '', quantity: 1, itemId: '' }],
      })
    }
  }, [editId, editDn, form])
  const [saving, setSaving] = React.useState(false)

  if (editId && !editDn) return <LoadingSpinner message="Loading delivery note..." />
  if (!form) return <LoadingSpinner />

  const save = async () => {
    if (!form.partyId) { toast.error('Select a customer'); return }
    setSaving(true)
    const url = editId ? `/api/delivery-notes?id=${editId}` : '/api/delivery-notes'
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { 
      const dn = await res.json()
      toast.success(`Delivery note ${editId ? 'updated' : 'created'}`)
      navigate('delivery-notes', { action: 'view', id: dn.id })
    }
    else toast.error('Failed')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={editId ? "Edit Delivery Note" : "New Delivery Note"} onBack={() => navigate('delivery-notes')} actions={<Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save</Button>} />
      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Customer *</Label><Select value={form.partyId} onValueChange={v => setForm({ ...form, partyId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Items</h3>
          <Button size="sm" variant="outline" onClick={() => setForm({ ...form, lines: [...form.lines, { description: '', quantity: 1, itemId: '' }] })}><Plus className="mr-1 h-4 w-4" /> Add Line</Button></div>
        <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Description</TableHead><TableHead className="w-28">Quantity</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>{form.lines.map((l, i) => (
            <TableRow key={i}>
              <TableCell><Select value={l.itemId} onValueChange={v => { const lines = [...form.lines]; const item = items?.find(it => it.id === v); lines[i] = { ...lines[i], itemId: v, description: item?.description || item?.name || lines[i].description }; setForm({ ...form, lines }) }}><SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger><SelectContent>{items?.map(it => <SelectItem key={it.id} value={it.id}>{it.sku} - {it.name}</SelectItem>)}</SelectContent></Select></TableCell>
              <TableCell><Input value={l.description} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], description: e.target.value }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell><Input type="number" step="0.01" value={l.quantity} onChange={e => { const lines = [...form.lines]; lines[i] = { ...lines[i], quantity: parseFloat(e.target.value) || 0 }; setForm({ ...form, lines }) }} /></TableCell>
              <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })} disabled={form.lines.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </CardContent></Card>
      <Card><CardContent className="p-5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></CardContent></Card>
    </div>
  )
}

function DeliveryNoteView({ navigate, id }: any & { id: string }) {
  const { data: dn, loading } = useFetch<any>(`/api/delivery-notes?id=${id}`, [id])
  const [showPdf, setShowPdf] = React.useState(false)

  if (loading || !dn) return <LoadingSpinner message="Loading delivery note..." />

  const handlePost = async () => {
    const res = await fetch('/api/delivery-notes/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'post', id }) })
    if (res.ok) { toast.success('Delivered'); window.location.reload() }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Delivery Note ${dn.number}`} 
        onBack={() => navigate('delivery-notes')} 
        actions={
          <>
            <Button variant="outline" onClick={() => setShowPdf(!showPdf)}><Printer className="mr-2 h-4 w-4" /> {showPdf ? 'Hide Preview' : 'Preview PDF'}</Button>
            {dn.status === 'DRAFT' && <Button variant="outline" onClick={() => navigate('delivery-notes', { action: 'edit', id })}>Edit</Button>}
            {dn.status === 'DRAFT' && <Button onClick={handlePost}><Send className="mr-2 h-4 w-4" /> Mark Delivered</Button>}
          </>
        }
      />
      {showPdf ? (
        <PdfPreview doctype="DELIVERY_NOTE" documentId={id} />
      ) : (
        <Card><CardContent className="p-6">
          <div className="flex items-start justify-between border-b pb-4">
            <div><h3 className="text-xl font-bold">{dn.partyName}</h3></div>
            <div className="text-right"><h2 className="text-2xl font-bold uppercase">Delivery Note</h2><p className="font-semibold text-emerald-600">{dn.number}</p><p className="text-sm text-muted-foreground">{fmtDate(dn.date)}</p><div className="mt-2"><StatusBadge status={dn.status} /></div></div>
          </div>
          <Table className="mt-6"><TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead></TableRow></TableHeader>
            <TableBody>{dn.lines.map((l: any, i: number) => <TableRow key={i}><TableCell>{l.description}</TableCell><TableCell className="text-right font-medium">{l.quantity}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  )
}
