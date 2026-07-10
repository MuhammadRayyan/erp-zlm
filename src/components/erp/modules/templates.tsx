'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Copy, Eye, FileEdit } from 'lucide-react'
import { DOCTYPES } from '@/lib/constants'
import { LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Template { id: string; name: string; doctype: string; htmlContent: string; cssContent: string; isDefault: boolean; isSystem: boolean }

export function TemplatesModule({ searchParams }: ModuleProps) {
  const { data: templates, loading, refetch } = useFetch<Template[]>('/api/templates')
  const [editing, setEditing] = React.useState<Template | null>(null)
  const [showForm, setShowForm] = React.useState(false)

  if (loading) return <LoadingSpinner message="Loading templates..." />

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); refetch() }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
  }

  const handleClone = async (t: Template) => {
    const res = await fetch('/api/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `${t.name} (Copy)`, doctype: t.doctype, htmlContent: t.htmlContent, cssContent: t.cssContent, isDefault: false }),
    })
    if (res.ok) { toast.success('Template cloned'); refetch() }
  }

  const grouped = DOCTYPES.map(dt => ({ ...dt, templates: (templates || []).filter(t => t.doctype === dt.value) }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">PDF Templates</h2><p className="text-sm text-muted-foreground">Customize invoice, bill, and document templates (HTML/CSS)</p></div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}><Plus className="mr-2 h-4 w-4" /> New Template</Button>
      </div>
      {grouped.map(g => g.templates.length > 0 && (
        <Card key={g.value}>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg"><FileEdit className="h-5 w-5 text-emerald-600" />{g.label}<Badge variant="secondary">{g.templates.length}</Badge></CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Default</TableHead><TableHead>System</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{g.templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.isDefault && <Badge className="bg-emerald-100 text-emerald-700">Default</Badge>}</TableCell>
                  <TableCell>{t.isSystem && <Badge variant="secondary">System</Badge>}</TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(t); setShowForm(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleClone(t)}><Copy className="h-3.5 w-3.5" /></Button>
                    {!t.isSystem && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
      {(!templates || templates.length === 0) && <EmptyState title="No templates" description="Default templates will be created automatically." />}
      {showForm && <TemplateForm template={editing} onClose={() => { setShowForm(false); setEditing(null) }} onSaved={() => { setShowForm(false); setEditing(null); refetch() }} />}
    </div>
  )
}

function TemplateForm({ template, onClose, onSaved }: { template: Template | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    name: template?.name || '', doctype: template?.doctype || 'SALES_INVOICE',
    htmlContent: template?.htmlContent || '', cssContent: template?.cssContent || '', isDefault: template?.isDefault || false,
  })
  const [preview, setPreview] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const generatePreview = async () => {
    const res = await fetch('/api/templates/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctype: form.doctype, htmlContent: form.htmlContent, cssContent: form.cssContent }),
    })
    const d = await res.json()
    setPreview(d.html)
  }

  const save = async () => {
    setSaving(true)
    const url = template ? `/api/templates?id=${template.id}` : '/api/templates'
    const method = template ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Saved'); onSaved() }
    else toast.error('Failed')
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{template ? 'Edit Template' : 'New Template'}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Document Type</Label><Select value={form.doctype} onValueChange={v => setForm({ ...form, doctype: v })} disabled={!!template}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DOCTYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-end gap-2"><div className="flex items-center gap-2"><input type="checkbox" id="def" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} /><Label htmlFor="def">Set as default</Label></div></div>
          </div>
          <Tabs defaultValue="html">
            <TabsList><TabsTrigger value="html">HTML Template</TabsTrigger><TabsTrigger value="css">CSS Styles</TabsTrigger><TabsTrigger value="preview" onClick={generatePreview}>Preview</TabsTrigger></TabsList>
            <TabsContent value="html"><Textarea value={form.htmlContent} onChange={e => setForm({ ...form, htmlContent: e.target.value })} rows={20} className="font-mono text-xs" /></TabsContent>
            <TabsContent value="css"><Textarea value={form.cssContent} onChange={e => setForm({ ...form, cssContent: e.target.value })} rows={20} className="font-mono text-xs" /></TabsContent>
            <TabsContent value="preview">{preview ? <iframe srcDoc={preview} className="h-[500px] w-full rounded border" title="Preview" /> : <div className="py-10 text-center text-muted-foreground">Click Preview to render</div>}</TabsContent>
          </Tabs>
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-semibold">Available placeholders:</p>
            <p className="mt-1 font-mono">{'{{business.name}}'}, {'{{invoice.number}}'}, {'{{invoice.date}}'}, {'{{invoice.total}}'}, {'{{party.name}}'}, {'{{party.trn}}'}, {'{{#each lines}}'}...{'{{/each}}'}, {'{{formatMoney value}}'}, {'{{formatDate value}}'}</p>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save Template'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
