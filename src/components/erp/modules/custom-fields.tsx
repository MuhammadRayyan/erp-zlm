'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Settings2, FolderTree } from 'lucide-react'
import { DOCTYPES, CUSTOM_FIELD_TYPES } from '@/lib/constants'
import { LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface CustomField { id: string; doctype: string; tab: string; section: string; fieldKey: string; label: string; labelAr: string | null; type: string; options: string | null; defaultValue: string | null; isRequired: boolean; isVisible: boolean; position: number }

export function CustomFieldsModule({ searchParams }: ModuleProps) {
  const { data, loading, refetch } = useFetch<{ fields: CustomField[]; grouped: Record<string, Record<string, CustomField[]>> }>('/api/custom-fields')
  const [doctype, setDoctype] = React.useState(searchParams.get('doctype') || 'SALES_INVOICE')
  const [showForm, setShowForm] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomField | null>(null)

  if (loading) return <LoadingSpinner message="Loading custom fields..." />
  const grouped = data?.grouped || {}

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom field?')) return
    const res = await fetch(`/api/custom-fields?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); refetch() }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Custom Fields</h2><p className="text-sm text-muted-foreground">Organize custom fields into tabs and sections (better than Manager.io)</p></div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" /> New Field</Button>
      </div>
      <div><Label>Document Type</Label><Select value={doctype} onValueChange={setDoctype}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{DOCTYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></div>

      {grouped[doctype] ? (
        <div className="space-y-4">
          {Object.entries(grouped[doctype]).map(([sectionName, fields]) => (
            <Card key={sectionName}>
              <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FolderTree className="h-4 w-4 text-emerald-600" />{sectionName}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table><TableHeader><TableRow><TableHead>Key</TableHead><TableHead>Label</TableHead><TableHead>Type</TableHead><TableHead>Required</TableHead><TableHead>Visible</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>{fields.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.fieldKey}</TableCell>
                      <TableCell><div className="font-medium">{f.label}</div>{f.labelAr && <div className="text-xs text-muted-foreground" dir="rtl">{f.labelAr}</div>}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{f.type}</Badge></TableCell>
                      <TableCell>{f.isRequired && <Badge className="bg-red-100 text-red-700 text-xs">Required</Badge>}</TableCell>
                      <TableCell>{f.isVisible ? <Badge variant="secondary" className="text-xs">Visible</Badge> : <Badge variant="secondary" className="text-xs">Hidden</Badge>}</TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(f); setShowForm(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No custom fields" description={`No custom fields defined for ${doctype} yet.`} action={{ label: 'New Field', onClick: () => { setEditing(null); setShowForm(true) } }} />}

      {showForm && <FieldForm field={editing} defaultDoctype={doctype} onClose={() => { setShowForm(false); setEditing(null) }} onSaved={() => { setShowForm(false); setEditing(null); refetch() }} />}
    </div>
  )
}

function FieldForm({ field, defaultDoctype, onClose, onSaved }: { field: CustomField | null; defaultDoctype: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    doctype: field?.doctype || defaultDoctype, tab: field?.tab || 'General', section: field?.section || 'Details',
    fieldKey: field?.fieldKey || '', label: field?.label || '', labelAr: field?.labelAr || '',
    type: field?.type || 'TEXT', options: field?.options ? JSON.parse(field.options).join(', ') : '',
    defaultValue: field?.defaultValue || '', isRequired: field?.isRequired || false, isVisible: field?.isVisible ?? true, position: field?.position || 0,
  })
  const [saving, setSaving] = React.useState(false)
  const save = async () => {
    setSaving(true)
    const body = { ...form, options: form.type === 'SELECT' ? form.options.split(',').map(s => s.trim()).filter(Boolean) : null }
    const url = field ? `/api/custom-fields?id=${field.id}` : '/api/custom-fields'
    const method = field ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { toast.success('Saved'); onSaved() }
    else toast.error('Failed')
    setSaving(false)
  }
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{field ? 'Edit Field' : 'New Custom Field'}</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Document Type</Label><Select value={form.doctype} onValueChange={v => setForm({ ...form, doctype: v })} disabled={!!field}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DOCTYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Field Type</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CUSTOM_FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Tab</Label><Input value={form.tab} onChange={e => setForm({ ...form, tab: e.target.value })} placeholder="General" /></div>
          <div><Label>Section</Label><Input value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="Details" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Field Key (internal)</Label><Input value={form.fieldKey} onChange={e => setForm({ ...form, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="custom_field_1" /></div>
          <div><Label>Position</Label><Input type="number" value={form.position} onChange={e => setForm({ ...form, position: parseInt(e.target.value) || 0 })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Label (English) *</Label><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} /></div>
          <div><Label>Label (Arabic)</Label><Input value={form.labelAr} onChange={e => setForm({ ...form, labelAr: e.target.value })} dir="rtl" /></div>
        </div>
        {form.type === 'SELECT' && <div><Label>Options (comma-separated)</Label><Input value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} placeholder="Option 1, Option 2, Option 3" /></div>}
        <div><Label>Default Value</Label><Input value={form.defaultValue} onChange={e => setForm({ ...form, defaultValue: e.target.value })} /></div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><Checkbox id="req" checked={form.isRequired} onCheckedChange={v => setForm({ ...form, isRequired: v === true })} /><Label htmlFor="req">Required</Label></div>
          <div className="flex items-center gap-2"><Checkbox id="vis" checked={form.isVisible} onCheckedChange={v => setForm({ ...form, isVisible: v === true })} /><Label htmlFor="vis">Visible</Label></div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving || !form.fieldKey || !form.label}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
    </DialogContent></Dialog>
  )
}
