'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Landmark, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface BankAccount { id: string; name: string; accountNumber: string | null; bankName: string | null; iban: string | null; openingBalance: number; currentBalance: number; currency: string; isActive: boolean; transactionCount: number }

export function BankingModule({ searchParams }: ModuleProps) {
  const { data: accounts, loading, refetch } = useFetch<BankAccount[]>('/api/banking')
  const [showForm, setShowForm] = React.useState(false)
  const [selectedAccount, setSelectedAccount] = React.useState<string | null>(null)

  if (loading) return <LoadingSpinner message="Loading bank accounts..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Bank Accounts</h2><p className="text-sm text-muted-foreground">Manage cash and bank accounts</p></div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Account</Button>
      </div>
      {!accounts || accounts.length === 0 ? <EmptyState title="No bank accounts" description="Add your first bank or cash account." action={{ label: 'New Account', onClick: () => setShowForm(true) }} /> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map(a => (
            <Card key={a.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedAccount(selectedAccount === a.id ? null : a.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950"><Landmark className="h-5 w-5 text-emerald-600" /></div>
                    <div><p className="font-semibold">{a.name}</p><p className="text-xs text-muted-foreground">{a.bankName || 'Cash'}</p></div>
                  </div>
                </div>
                <div className="mt-4"><p className="text-2xl font-bold">{fmtMoney(a.currentBalance, a.currency)}</p><p className="text-xs text-muted-foreground">Current balance</p></div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  {a.accountNumber && <span>•••• {a.accountNumber.slice(-4)}</span>}
                  {a.iban && <span className="font-mono">{a.iban.slice(-8)}</span>}
                </div>
              </CardContent>
              {selectedAccount === a.id && <BankTransactions accountId={a.id} />}
            </Card>
          ))}
        </div>
      )}
      {showForm && <BankAccountForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch() }} />}
    </div>
  )
}

function BankTransactions({ accountId }: { accountId: string }) {
  const { data: transactions } = useFetch<{ id: string; date: string; description: string | null; amount: number; type: string; reference: string | null }[]>(`/api/banking/transactions?accountId=${accountId}`)
  const [showTxForm, setShowTxForm] = React.useState(false)
  return (
    <div className="border-t bg-muted/30 p-4" onClick={e => e.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between"><h4 className="text-sm font-semibold">Recent Transactions</h4><Button size="sm" variant="outline" onClick={() => setShowTxForm(true)}><Plus className="mr-1 h-3 w-3" /> Add</Button></div>
      {transactions && transactions.length > 0 ? (
        <div className="max-h-48 overflow-y-auto"><Table><TableBody>{transactions.slice(0, 10).map(t => (
          <TableRow key={t.id}><TableCell className="py-2"><div className="text-xs font-medium">{fmtDate(t.date)}</div><div className="text-xs text-muted-foreground">{t.description || t.type}</div></TableCell>
            <TableCell className="py-2 text-right"><span className={`text-sm font-medium ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{t.amount >= 0 ? '+' : ''}{fmtMoney(t.amount)}</span></TableCell>
          </TableRow>
        ))}</TableBody></Table></div>
      ) : <p className="text-xs text-muted-foreground">No transactions yet</p>}
      {showTxForm && <TransactionForm accountId={accountId} onClose={() => setShowTxForm(false)} onSaved={() => setShowTxForm(false)} />}
    </div>
  )
}

function TransactionForm({ accountId, onClose, onSaved }: { accountId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({ date: new Date().toISOString().split('T')[0], description: '', amount: 0, type: 'DEPOSIT', reference: '' })
  const [saving, setSaving] = React.useState(false)
  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/banking/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, bankAccountId: accountId }) })
    if (res.ok) { toast.success('Transaction added'); onSaved(); window.location.reload() }
    else toast.error('Failed')
    setSaving(false)
  }
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEPOSIT">Deposit</SelectItem><SelectItem value="WITHDRAWAL">Withdrawal</SelectItem><SelectItem value="FEE">Bank Fee</SelectItem><SelectItem value="INTEREST">Interest</SelectItem></SelectContent></Select></div>
          <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount || ''} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} /></div>
        </div>
        <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>Reference</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
    </DialogContent></Dialog>
  )
}

function BankAccountForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState({ name: '', bankName: '', accountNumber: '', iban: '', branch: '', openingBalance: 0, currency: 'AED' })
  const [saving, setSaving] = React.useState(false)
  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/banking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Account created'); onSaved() }
    else toast.error('Failed')
    setSaving(false)
  }
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>New Bank Account</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-2">
        <div><Label>Account Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Main Bank Account" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bank Name</Label><Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} /></div>
          <div><Label>Branch</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Account Number</Label><Input value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} /></div>
          <div><Label>IBAN</Label><Input value={form.iban} onChange={e => setForm({ ...form, iban: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Currency</Label><Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} /></div>
          <div><Label>Opening Balance</Label><Input type="number" step="0.01" value={form.openingBalance || ''} onChange={e => setForm({ ...form, openingBalance: parseFloat(e.target.value) || 0 })} /></div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
    </DialogContent></Dialog>
  )
}
