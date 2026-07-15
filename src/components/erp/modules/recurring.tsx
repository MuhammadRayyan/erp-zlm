'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Repeat, Play, Trash2, Calendar } from 'lucide-react'
import { fmtDate, fmtMoney, LoadingSpinner, EmptyState, useFetch, StatusBadge } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

type RecurringType = 'SALES_INVOICE' | 'PURCHASE_BILL' | 'JOURNAL'
type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

interface RecurringTransaction {
  id: string
  type: RecurringType
  template: Record<string, unknown>
  frequency: RecurringFrequency
  interval: number
  startDate: string
  endDate: string | null
  nextRunDate: string
  lastRunDate: string | null
  isActive: boolean
}

interface Party { id: string; name: string; type: string }
interface Account { id: string; code: string; name: string; type: string }

export function RecurringModule(_props: ModuleProps) {
  const { data: items, loading, refetch } = useFetch<RecurringTransaction[]>('/api/recurring')
  const [showForm, setShowForm] = React.useState(false)
  const [running, setRunning] = React.useState<string | null>(null)

  const runNow = async (id: string) => {
    setRunning(id)
    try {
      const res = await fetch(`/api/recurring/run?id=${id}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Generated ${data.generated?.number || 'transaction'}`)
        refetch()
      } else {
        toast.error(data.error || 'Failed to run')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to run: ${msg}`)
    } finally {
      setRunning(null)
    }
  }

  const toggleActive = async (rt: RecurringTransaction) => {
    const res = await fetch(`/api/recurring?id=${rt.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rt.isActive }),
    })
    if (res.ok) { toast.success(`Recurring ${!rt.isActive ? 'activated' : 'paused'}`); refetch() }
    else toast.error('Failed to update')
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this recurring transaction?')) return
    const res = await fetch(`/api/recurring?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  if (loading) return <LoadingSpinner message="Loading recurring transactions..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Recurring Transactions</h2>
          <p className="text-sm text-muted-foreground">Automate repeating invoices, bills, and journal entries</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Recurring</Button>
      </div>

      {!items || items.length === 0 ? (
        <EmptyState
          title="No recurring transactions"
          description="Create your first recurring transaction to automate your accounting."
          action={{ label: 'New Recurring', onClick: () => setShowForm(true) }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(rt => {
                  const summary = summarizeTemplate(rt.type, rt.template)
                  return (
                    <TableRow key={rt.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Repeat className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{typeLabel(rt.type)}</div>
                            <div className="text-xs text-muted-foreground">{summary}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          <Calendar className="mr-1 h-3 w-3" />
                          Every {rt.interval > 1 ? `${rt.interval} ` : ''}{rt.frequency.toLowerCase().replace(/y$/, rt.interval > 1 ? 's' : 'y')}
                        </Badge>
                      </TableCell>
                      <TableCell>{fmtDate(rt.nextRunDate)}</TableCell>
                      <TableCell>{rt.lastRunDate ? fmtDate(rt.lastRunDate) : '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {rt.isActive
                            ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>
                            : <Badge className="bg-gray-200 text-gray-700">Paused</Badge>}
                          <Switch checked={rt.isActive} onCheckedChange={() => toggleActive(rt)} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => runNow(rt.id)} disabled={running === rt.id || !rt.isActive}>
                            <Play className="mr-1 h-3 w-3" />
                            {running === rt.id ? 'Running...' : 'Run Now'}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => remove(rt.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showForm && <RecurringForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch() }} />}
    </div>
  )
}

// ============================================================
// Create form — supports SALES_INVOICE, PURCHASE_BILL, JOURNAL
// ============================================================

function RecurringForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = React.useState<RecurringType>('JOURNAL')
  const [frequency, setFrequency] = React.useState<RecurringFrequency>('MONTHLY')
  const [interval, setInterval] = React.useState(1)
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  // Invoice / bill template state
  const [partyId, setPartyId] = React.useState('')
  const [reference, setReference] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [autoPost, setAutoPost] = React.useState(true)
  const [lines, setLines] = React.useState([
    { description: '', quantity: 1, unitPrice: 0, discount: 0 },
  ])

  // Journal template state
  const [journalDescription, setJournalDescription] = React.useState('')
  const [journalLines, setJournalLines] = React.useState([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ])

  const { data: customers } = useFetch<Party[]>('/api/parties?type=CUSTOMER')
  const { data: suppliers } = useFetch<Party[]>('/api/parties?type=SUPPLIER')
  const { data: accounts } = useFetch<Account[]>('/api/accounts')

  const parties = type === 'PURCHASE_BILL' ? suppliers : customers

  const addLine = () => setLines([...lines, { description: '', quantity: 1, unitPrice: 0, discount: 0 }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: string, value: string | number) => {
    const updated = [...lines]
    updated[i] = { ...updated[i], [field]: value }
    setLines(updated)
  }

  const addJournalLine = () => setJournalLines([...journalLines, { accountId: '', debit: 0, credit: 0, description: '' }])
  const removeJournalLine = (i: number) => setJournalLines(journalLines.filter((_, idx) => idx !== i))
  const updateJournalLine = (i: number, field: string, value: string | number) => {
    const updated = [...journalLines]
    updated[i] = { ...updated[i], [field]: value }
    setJournalLines(updated)
  }

  const totalDebit = journalLines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = journalLines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const save = async () => {
    setSaving(true)
    try {
      let template: Record<string, unknown>
      if (type === 'JOURNAL') {
        if (!isBalanced) { toast.error('Journal entry not balanced'); setSaving(false); return }
        if (journalLines.some(l => !l.accountId)) { toast.error('All journal lines need an account'); setSaving(false); return }
        template = { description: journalDescription, reference, lines: journalLines }
      } else {
        if (!partyId) { toast.error('Select a party'); setSaving(false); return }
        if (lines.some(l => !l.description)) { toast.error('All lines need a description'); setSaving(false); return }
        template = { partyId, reference, notes, post: autoPost, lines }
      }

      const res = await fetch('/api/recurring', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, template, frequency, interval,
          startDate,
          endDate: endDate || null,
          nextRunDate: startDate,
          isActive,
        }),
      })
      if (res.ok) { toast.success('Recurring transaction created'); onSaved() }
      else { const e = await res.json(); toast.error(e.error || 'Failed') }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Recurring Transaction</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Transaction Type</Label>
            <Select value={type} onValueChange={(v: RecurringType) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SALES_INVOICE">Sales Invoice</SelectItem>
                <SelectItem value="PURCHASE_BILL">Purchase Bill</SelectItem>
                <SelectItem value="JOURNAL">Journal Entry</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={(v: RecurringFrequency) => setFrequency(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Interval (every N {frequency.toLowerCase().replace(/y$/, 's')})</Label>
            <Input type="number" min={1} value={interval} onChange={e => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))} />
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End Date (optional)</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Active</Label>
            <div className="flex h-10 items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm text-muted-foreground">{isActive ? 'Will run on schedule' : 'Paused'}</span>
            </div>
          </div>
        </div>

        {/* Template section */}
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold">Transaction Template</h4>
          {type === 'JOURNAL' ? (
            <JournalTemplateEditor
              lines={journalLines}
              accounts={accounts || []}
              description={journalDescription}
              reference={reference}
              totalDebit={totalDebit}
              totalCredit={totalCredit}
              isBalanced={isBalanced}
              onAdd={addJournalLine}
              onRemove={removeJournalLine}
              onUpdate={updateJournalLine}
              onDescriptionChange={setJournalDescription}
              onReferenceChange={setReference}
            />
          ) : (
            <InvoiceTemplateEditor
              type={type}
              parties={parties || []}
              partyId={partyId}
              reference={reference}
              notes={notes}
              autoPost={autoPost}
              lines={lines}
              onPartyChange={setPartyId}
              onReferenceChange={setReference}
              onNotesChange={setNotes}
              onAutoPostChange={setAutoPost}
              onAddLine={addLine}
              onRemoveLine={removeLine}
              onUpdateLine={updateLine}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Create Recurring'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Sub-components
// ============================================================

function JournalTemplateEditor({
  lines, accounts, description, reference, totalDebit, totalCredit, isBalanced,
  onAdd, onRemove, onUpdate, onDescriptionChange, onReferenceChange,
}: {
  lines: Array<{ accountId: string; debit: number; credit: number; description: string }>
  accounts: Account[]
  description: string
  reference: string
  totalDebit: number
  totalCredit: number
  isBalanced: boolean
  onAdd: () => void
  onRemove: (i: number) => void
  onUpdate: (i: number, field: string, value: string | number) => void
  onDescriptionChange: (v: string) => void
  onReferenceChange: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Reference</Label><Input value={reference} onChange={e => onReferenceChange(e.target.value)} /></div>
        <div><Label>Description</Label><Input value={description} onChange={e => onDescriptionChange(e.target.value)} /></div>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Select value={l.accountId} onValueChange={v => onUpdate(i, 'accountId', v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Input value={l.description} onChange={e => onUpdate(i, 'description', e.target.value)} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="text-right" value={l.debit || ''} onChange={e => onUpdate(i, 'debit', parseFloat(e.target.value) || 0)} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="text-right" value={l.credit || ''} onChange={e => onUpdate(i, 'credit', parseFloat(e.target.value) || 0)} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => onRemove(i)} disabled={lines.length <= 2}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add Line</Button>
      <div className="flex items-center justify-between rounded-lg bg-muted p-3">
        <span className="text-sm font-medium">
          {isBalanced ? <span className="text-emerald-600">✓ Balanced</span> : <span className="text-red-600">⚠ Not balanced</span>}
        </span>
        <div className="flex gap-4 text-sm">
          <span>Debit: <strong>{fmtMoney(totalDebit)}</strong></span>
          <span>Credit: <strong>{fmtMoney(totalCredit)}</strong></span>
          <span>Diff: <strong className={Math.abs(totalDebit - totalCredit) < 0.01 ? 'text-emerald-600' : 'text-red-600'}>{fmtMoney(totalDebit - totalCredit)}</strong></span>
        </div>
      </div>
    </div>
  )
}

function InvoiceTemplateEditor({
  type, parties, partyId, reference, notes, autoPost, lines,
  onPartyChange, onReferenceChange, onNotesChange, onAutoPostChange,
  onAddLine, onRemoveLine, onUpdateLine,
}: {
  type: RecurringType
  parties: Party[]
  partyId: string
  reference: string
  notes: string
  autoPost: boolean
  lines: Array<{ description: string; quantity: number; unitPrice: number; discount: number }>
  onPartyChange: (v: string) => void
  onReferenceChange: (v: string) => void
  onNotesChange: (v: string) => void
  onAutoPostChange: (v: boolean) => void
  onAddLine: () => void
  onRemoveLine: (i: number) => void
  onUpdateLine: (i: number, field: string, value: string | number) => void
}) {
  const total = lines.reduce((s, l) => s + (l.quantity * l.unitPrice * (1 - (l.discount || 0) / 100)), 0)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{type === 'PURCHASE_BILL' ? 'Supplier' : 'Customer'}</Label>
          <Select value={partyId} onValueChange={onPartyChange}>
            <SelectTrigger><SelectValue placeholder={`Select ${type === 'PURCHASE_BILL' ? 'supplier' : 'customer'}`} /></SelectTrigger>
            <SelectContent>
              {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Reference</Label><Input value={reference} onChange={e => onReferenceChange(e.target.value)} /></div>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Disc %</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell><Input value={l.description} onChange={e => onUpdateLine(i, 'description', e.target.value)} /></TableCell>
                <TableCell><Input type="number" step="0.001" className="text-right w-20" value={l.quantity || ''} onChange={e => onUpdateLine(i, 'quantity', parseFloat(e.target.value) || 0)} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="text-right w-28" value={l.unitPrice || ''} onChange={e => onUpdateLine(i, 'unitPrice', parseFloat(e.target.value) || 0)} /></TableCell>
                <TableCell><Input type="number" step="0.01" className="text-right w-20" value={l.discount || ''} onChange={e => onUpdateLine(i, 'discount', parseFloat(e.target.value) || 0)} /></TableCell>
                <TableCell className="text-right font-medium">{fmtMoney(l.quantity * l.unitPrice * (1 - (l.discount || 0) / 100))}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => onRemoveLine(i)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={onAddLine}><Plus className="mr-1 h-4 w-4" /> Add Line</Button>
      <div className="flex items-center justify-between rounded-lg bg-muted p-3">
        <div className="flex items-center gap-2">
          <Switch checked={autoPost} onCheckedChange={onAutoPostChange} />
          <span className="text-sm">Auto-post on each run</span>
        </div>
        <span className="text-sm font-medium">Total: <strong>{fmtMoney(total)}</strong></span>
      </div>
      <div>
        <Label>Notes</Label>
        <Input value={notes} onChange={e => onNotesChange(e.target.value)} placeholder="Optional notes for each generated document" />
      </div>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function typeLabel(type: RecurringType): string {
  switch (type) {
    case 'SALES_INVOICE': return 'Sales Invoice'
    case 'PURCHASE_BILL': return 'Purchase Bill'
    case 'JOURNAL': return 'Journal Entry'
  }
}

function summarizeTemplate(type: RecurringType, template: Record<string, unknown>): string {
  if (type === 'JOURNAL') {
    const lines = (template.lines as Array<{ accountId?: string; debit?: number; credit?: number; description?: string }> | undefined) || []
    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const desc = (template.description as string | undefined) || 'No description'
    return `${desc} • ${fmtMoney(totalDebit)} • ${lines.length} lines`
  }
  const partyName = (template.partyId as string | undefined) || 'No party'
  const lines = (template.lines as Array<{ quantity?: number; unitPrice?: number; discount?: number }> | undefined) || []
  const total = lines.reduce((s, l) => s + ((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discount) || 0) / 100)), 0)
  return `Party: ${partyName.slice(0, 8)}... • ${fmtMoney(total)} • ${lines.length} lines`
}
