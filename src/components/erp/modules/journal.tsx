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
import { Plus, BookOpen } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface JournalEntry {
  id: string
  number: string
  date: string
  reference: string | null
  description: string | null
  sourceType: string | null
  isPosted: boolean
  isReversed: boolean
  createdBy: string
  totalDebit: number
  totalCredit: number
  lines: { id: string; accountCode: string; accountName: string; debit: number; credit: number; description: string | null }[]
}

interface Account { id: string; code: string; name: string; type: string }

export function JournalModule({ searchParams, navigate }: ModuleProps) {
  const { data: entries, loading, refetch } = useFetch<JournalEntry[]>('/api/journal')
  const [showForm, setShowForm] = React.useState(searchParams.get('action') === 'new')

  if (loading) return <LoadingSpinner message="Loading journal entries..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Journal Entries</h2>
          <p className="text-sm text-muted-foreground">Double-entry journal with automatic validation</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
      </div>

      {!entries || entries.length === 0 ? (
        <EmptyState title="No journal entries" description="Create your first journal entry." action={{ label: 'New Entry', onClick: () => setShowForm(true) }} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.number}</TableCell>
                    <TableCell>{fmtDate(e.date)}</TableCell>
                    <TableCell>{e.reference || '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{e.description || '—'}</TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{e.sourceType || 'MANUAL'}</span></TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(e.totalDebit)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(e.totalCredit)}</TableCell>
                    <TableCell>{e.isReversed ? <span className="text-xs text-red-600">Reversed</span> : <span className="text-xs text-emerald-600">Posted</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showForm && <JournalForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch() }} />}
    </div>
  )
}

function JournalForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data: accounts } = useFetch<Account[]>('/api/accounts')
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0])
  const [reference, setReference] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [lines, setLines] = React.useState([
    { accountId: '', debit: 0, credit: 0, description: '' },
    { accountId: '', debit: 0, credit: 0, description: '' },
  ])
  const [saving, setSaving] = React.useState(false)

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const addLine = () => setLines([...lines, { accountId: '', debit: 0, credit: 0, description: '' }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: string, value: string | number) => {
    const updated = [...lines]
    updated[i] = { ...updated[i], [field]: value }
    setLines(updated)
  }

  const save = async () => {
    if (!isBalanced) { toast.error('Entry not balanced. Debits must equal credits.'); return }
    if (lines.some(l => !l.accountId)) { toast.error('All lines must have an account'); return }

    setSaving(true)
    const res = await fetch('/api/journal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, reference, description, lines }),
    })
    if (res.ok) { toast.success('Journal entry posted'); onSaved() }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
    setSaving(false)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
          <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={l.accountId} onValueChange={v => updateLine(i, 'accountId', v)}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} /></TableCell>
                  <TableCell><Input type="number" step="0.01" className="text-right" value={l.debit || ''} onChange={e => updateLine(i, 'debit', parseFloat(e.target.value) || 0)} /></TableCell>
                  <TableCell><Input type="number" step="0.01" className="text-right" value={l.credit || ''} onChange={e => updateLine(i, 'credit', parseFloat(e.target.value) || 0)} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => removeLine(i)} disabled={lines.length <= 2}><Plus className="h-3.5 w-3.5 rotate-45" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Button variant="outline" size="sm" onClick={addLine}><Plus className="mr-1 h-4 w-4" /> Add Line</Button>

        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <span className="text-sm font-medium">
            {isBalanced ? <span className="text-emerald-600">✓ Balanced</span> : <span className="text-red-600">⚠ Not balanced</span>}
          </span>
          <div className="flex gap-4 text-sm">
            <span>Total Debit: <strong>{fmtMoney(totalDebit)}</strong></span>
            <span>Total Credit: <strong>{fmtMoney(totalCredit)}</strong></span>
            <span>Difference: <strong className={Math.abs(totalDebit - totalCredit) < 0.01 ? 'text-emerald-600' : 'text-red-600'}>{fmtMoney(totalDebit - totalCredit)}</strong></span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !isBalanced}>{saving ? 'Posting...' : 'Post Entry'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
