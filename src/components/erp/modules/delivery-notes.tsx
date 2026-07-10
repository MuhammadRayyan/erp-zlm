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

export function DeliveryNotesModule({ navigate, searchParams }: ModuleProps) {
  const action = searchParams.get('action')
  if (action === 'new') return <DeliveryNoteForm navigate={navigate} />
  return <DeliveryNoteList navigate={navigate} />
}

function DeliveryNoteList({ navigate }: ModuleProps) {
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
          <TableBody>{dns.map(d => <TableRow key={d.id}><TableCell className="font-medium">{d.number}</TableCell><TableCell>{fmtDate(d.date)}</TableCell><TableCell>{d.partyName}</TableCell><TableCell><StatusBadge status={d.status} /></TableCell></TableRow>)}</TableBody>
        </Table></CardContent></Card>
      )}
    </div>
  )
}

function DeliveryNoteForm({ navigate }: ModuleProps) {
  const { data: parties } = useFetch<{ id: string; name: string }[]>('/api/parties?type=CUSTOMER')
  const { data: items } = useFetch<{ id: string; name: string; sku: string; description: string | null }[]>('/api/items')
  const [form, setForm] = React.useState({
    partyId: '', date: new Date().toISOString().split('T')[0], reference: '', notes: '',
    lines: [{ description: '', quantity: 1, itemId: '' }],
  })
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    if (!form.partyId) { toast.error('Select a customer'); return }
    setSaving(true)
    const res = await fetch('/api/delivery-notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Delivery note created'); navigate('delivery-notes') }
    else toast.error('Failed')
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Delivery Note" onBack={() => navigate('delivery-notes')} actions={<Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" /> Save</Button>} />
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
