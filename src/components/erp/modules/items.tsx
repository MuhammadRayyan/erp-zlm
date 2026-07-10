'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react'
import { fmtMoney, fmtNumber, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Item { id: string; sku: string; name: string; nameAr: string | null; description: string | null; unit: string; category: string | null; salePrice: number; purchasePrice: number; stockQty: number; reorderLevel: number; isInventory: boolean; isActive: boolean; taxRateId: string | null }

export function ItemsModule({ searchParams }: ModuleProps) {
  const { data: items, loading, refetch } = useFetch<Item[]>('/api/items')
  const [search, setSearch] = React.useState('')
  const [showForm, setShowForm] = React.useState(false)
  const [editing, setEditing] = React.useState<Item | null>(null)

  if (loading) return <LoadingSpinner message="Loading items..." />
  const filtered = (items || []).filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()))

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return
    const res = await fetch(`/api/items?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Inventory Items</h2><p className="text-sm text-muted-foreground">Manage products and services with stock tracking</p></div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" /> New Item</Button>
      </div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      {filtered.length === 0 ? <EmptyState title="No items" description="Add your first product or service." action={{ label: 'New Item', onClick: () => { setEditing(null); setShowForm(true) } }} /> : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Sale Price</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.map(it => (
            <TableRow key={it.id}>
              <TableCell className="font-mono text-xs">{it.sku}</TableCell>
              <TableCell><div className="font-medium">{it.name}</div>{it.nameAr && <div className="text-xs text-muted-foreground" dir="rtl">{it.nameAr}</div>}</TableCell>
              <TableCell className="text-xs">{it.category || '—'}</TableCell>
              <TableCell className="text-right font-medium">{fmtMoney(it.salePrice)}</TableCell>
              <TableCell className="text-right"><span className={it.stockQty <= it.reorderLevel ? 'font-bold text-red-600' : ''}>{fmtNumber(it.stockQty)}</span></TableCell>
              <TableCell><Badge variant={it.isActive ? 'default' : 'secondary'} className="text-xs">{it.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
              <TableCell className="text-right"><div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(it); setShowForm(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(it.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></CardContent></Card>
      )}
      {showForm && <ItemForm item={editing} onClose={() => { setShowForm(false); setEditing(null) }} onSaved={() => { setShowForm(false); setEditing(null); refetch() }} />}
    </div>
  )
}

function ItemForm({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    sku: item?.sku || '', name: item?.name || '', nameAr: item?.nameAr || '', description: item?.description || '',
    unit: item?.unit || 'PCS', category: item?.category || '', salePrice: item?.salePrice || 0, purchasePrice: item?.purchasePrice || 0,
    stockQty: item?.stockQty || 0, reorderLevel: item?.reorderLevel || 0, isInventory: item?.isInventory ?? true, isActive: item?.isActive ?? true,
  })
  const [saving, setSaving] = React.useState(false)
  const save = async () => {
    setSaving(true)
    const url = item ? `/api/items?id=${item.id}` : '/api/items'
    const method = item ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success(item ? 'Updated' : 'Created'); onSaved() }
    else toast.error('Failed')
    setSaving(false)
  }
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{item ? 'Edit Item' : 'New Item'}</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>SKU *</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
          <div><Label>Unit</Label><Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PCS">Pieces</SelectItem><SelectItem value="KG">Kilogram</SelectItem><SelectItem value="LTR">Liter</SelectItem><SelectItem value="MTR">Meter</SelectItem><SelectItem value="BOX">Box</SelectItem><SelectItem value="HR">Hour</SelectItem><SelectItem value="DAY">Day</SelectItem></SelectContent></Select></div>
        </div>
        <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Name (Arabic)</Label><Input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" /></div>
        <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
          <div><Label>Reorder Level</Label><Input type="number" step="0.01" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Sale Price</Label><Input type="number" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: parseFloat(e.target.value) || 0 })} /></div>
          <div><Label>Purchase Price</Label><Input type="number" step="0.01" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div><Label>Current Stock</Label><Input type="number" step="0.01" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: parseFloat(e.target.value) || 0 })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving || !form.sku || !form.name}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
    </DialogContent></Dialog>
  )
}
