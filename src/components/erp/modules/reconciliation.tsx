'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Scale, Plus, ArrowLeft, Check, X, CheckCircle2, Clock, Ban } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, useFetch, PageHeader } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface BankAccount {
  id: string
  name: string
  accountNumber: string | null
  currency: string
  currentBalance: number
}

interface ReconciliationListItem {
  id: string
  bankAccountId: string
  bankAccountName: string
  currency: string
  statementDate: string
  statementEndingBalance: number
  status: string
  reconciledAt: string | null
  matchedCount: number
  createdAt: string
}

interface BankTx {
  id: string
  date: string
  description: string | null
  reference: string | null
  amount: number
  type: string
  isReconciled: boolean
  reconciliationId: string | null
  paymentId: string | null
}

interface SystemPayment {
  id: string
  number: string
  date: string
  type: string
  partyName: string
  amount: number
  method: string
  reference: string | null
  description: string | null
  isReconciled: boolean
  isMatched: boolean
}

interface ReconciliationDetail {
  id: string
  bankAccountId: string
  bankAccountName: string
  currency: string
  statementDate: string
  statementEndingBalance: number
  status: string
  reconciledAt: string | null
  openingBalance: number
  currentBalance: number
  clearedBalance: number
  bookBalance: number
  difference: number
  isBalanced: boolean
  bankTransactions: BankTx[]
  systemPayments: SystemPayment[]
}

const STATUS_BADGE: Record<string, string> = {
  IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELLED: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export function ReconciliationModule({ }: ModuleProps) {
  const [view, setView] = React.useState<'list' | 'detail' | 'create'>('list')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  if (view === 'detail' && selectedId) {
    return <ReconciliationDetail reconciliationId={selectedId} onBack={() => { setView('list'); setSelectedId(null) }} />
  }
  if (view === 'create') {
    return <CreateReconciliation onClose={() => setView('list')} onCreated={(id) => { setView('detail'); setSelectedId(id) }} />
  }
  return <ReconciliationList onOpen={(id) => { setView('detail'); setSelectedId(id) }} onCreate={() => setView('create')} />
}

function ReconciliationList({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const { data: recs, loading, refetch } = useFetch<ReconciliationListItem[]>('/api/reconciliation')

  if (loading) return <LoadingSpinner message="Loading reconciliations..." />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Reconciliation"
        description="Match bank statement transactions with system payments"
        actions={
          <Button onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" /> New Reconciliation
          </Button>
        }
      />

      {!recs || recs.length === 0 ? (
        <EmptyState
          title="No reconciliations yet"
          description="Start your first bank reconciliation to match bank statements with system transactions."
          action={{ label: 'New Reconciliation', onClick: onCreate }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Statement Date</TableHead>
                  <TableHead className="text-right">Ending Balance</TableHead>
                  <TableHead className="text-center">Matched</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Reconciled At</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{r.bankAccountName}</div>
                          <div className="text-xs text-muted-foreground">{r.currency}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{fmtDate(r.statementDate)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(r.statementEndingBalance, r.currency)}</TableCell>
                    <TableCell className="text-center">{r.matchedCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={STATUS_BADGE[r.status]}>
                        {r.status === 'IN_PROGRESS' && <Clock className="mr-1 h-3 w-3" />}
                        {r.status === 'COMPLETED' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {r.status === 'CANCELLED' && <Ban className="mr-1 h-3 w-3" />}
                        {r.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.reconciledAt ? fmtDate(r.reconciledAt) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => onOpen(r.id)}>
                        {r.status === 'IN_PROGRESS' ? 'Continue' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <Button variant="ghost" size="sm" onClick={() => refetch()}>Refresh</Button>
    </div>
  )
}

function CreateReconciliation({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { data: accounts, loading } = useFetch<BankAccount[]>('/api/banking')
  const [bankAccountId, setBankAccountId] = React.useState('')
  const [statementDate, setStatementDate] = React.useState(new Date().toISOString().split('T')[0])
  const [endingBalance, setEndingBalance] = React.useState(0)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    if (!bankAccountId) { toast.error('Select a bank account'); return }
    if (!statementDate) { toast.error('Statement date is required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId, statementDate, statementEndingBalance: endingBalance }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      toast.success('Reconciliation created')
      onCreated(data.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Reconciliation" description="Start a new bank reconciliation session" onBack={onClose} />
      <Card>
        <CardContent className="p-6 max-w-xl">
          {loading ? <LoadingSpinner /> : (
            <div className="space-y-4">
              <div>
                <Label>Bank Account *</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent>
                    {(accounts || []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({fmtMoney(a.currentBalance, a.currency)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Statement Date *</Label>
                  <Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
                </div>
                <div>
                  <Label>Statement Ending Balance *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={endingBalance || ''}
                    onChange={(e) => setEndingBalance(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? 'Creating...' : 'Start Reconciliation'}</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReconciliationDetail({ reconciliationId, onBack }: { reconciliationId: string; onBack: () => void }) {
  const { data: rec, loading, refetch } = useFetch<ReconciliationDetail>(`/api/reconciliation/${reconciliationId}`)
  const [selectedBankTx, setSelectedBankTx] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (loading || !rec) return <LoadingSpinner message="Loading reconciliation..." />

  const matchTx = async (bankTransactionId: string, paymentId?: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/reconciliation/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconciliationId, bankTransactionId, paymentId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to match'); return }
      toast.success('Matched')
      setSelectedBankTx(null)
      refetch()
    } finally { setBusy(false) }
  }

  const unmatchTx = async (bankTransactionId: string) => {
    if (!confirm('Unmatch this transaction?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/reconciliation/match?bankTransactionId=${bankTransactionId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to unmatch'); return }
      toast.success('Unmatched')
      refetch()
    } finally { setBusy(false) }
  }

  const complete = async () => {
    if (!confirm('Complete this reconciliation? This will lock all matched transactions.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/reconciliation/${reconciliationId}?action=complete`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to complete'); return }
      toast.success('Reconciliation completed')
      refetch()
    } finally { setBusy(false) }
  }

  const cancel = async () => {
    if (!confirm('Cancel this reconciliation? All matches will be undone.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/reconciliation/${reconciliationId}?action=cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to cancel'); return }
      toast.success('Reconciliation cancelled')
      onBack()
    } finally { setBusy(false) }
  }

  const isReadOnly = rec.status !== 'IN_PROGRESS'

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Reconciliation — ${rec.bankAccountName}`}
        description={`Statement date: ${fmtDate(rec.statementDate)}`}
        onBack={onBack}
        actions={
          !isReadOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancel} disabled={busy}>Cancel</Button>
              <Button onClick={complete} disabled={busy || !rec.isBalanced}>
                <Check className="mr-2 h-4 w-4" /> Complete
              </Button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Opening Balance</p>
          <p className="text-lg font-bold">{fmtMoney(rec.openingBalance, rec.currency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Cleared Balance</p>
          <p className="text-lg font-bold text-emerald-600">{fmtMoney(rec.clearedBalance, rec.currency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Statement Balance</p>
          <p className="text-lg font-bold">{fmtMoney(rec.statementEndingBalance, rec.currency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Book Balance</p>
          <p className="text-lg font-bold">{fmtMoney(rec.bookBalance, rec.currency)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Difference</p>
          <p className={`text-lg font-bold ${rec.isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmtMoney(rec.difference, rec.currency)}
          </p>
        </CardContent></Card>
      </div>

      {!rec.isBalanced && !isReadOnly && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠ The reconciliation is not balanced. Difference must be zero to complete.
        </div>
      )}
      {rec.status === 'COMPLETED' && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          ✓ This reconciliation was completed on {fmtDate(rec.reconciledAt || rec.statementDate)}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bank statement transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Bank Statement Transactions</span>
              <Badge variant="secondary">{rec.bankTransactions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-16 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rec.bankTransactions.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No transactions</TableCell></TableRow>
                  ) : rec.bankTransactions.map((t) => (
                    <TableRow
                      key={t.id}
                      className={selectedBankTx === t.id ? 'bg-emerald-50 dark:bg-emerald-950/40' : t.isReconciled && t.reconciliationId === rec.id ? 'opacity-60' : 'cursor-pointer hover:bg-muted/50'}
                      onClick={() => !t.isReconciled && setSelectedBankTx(selectedBankTx === t.id ? null : t.id)}
                    >
                      <TableCell className="text-xs">{fmtDate(t.date)}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{t.description || t.type}</div>
                        {t.reference && <div className="text-xs text-muted-foreground">{t.reference}</div>}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-medium ${t.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtMoney(t.amount, rec.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        {t.isReconciled && t.reconciliationId === rec.id ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-600"
                            disabled={isReadOnly}
                            onClick={(e) => { e.stopPropagation(); unmatchTx(t.id) }}
                            title="Unmatch"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        ) : selectedBankTx === t.id ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Selected</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* System payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>System Payments</span>
              <Badge variant="secondary">{rec.systemPayments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-24 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rec.systemPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No unreconciled payments</TableCell></TableRow>
                  ) : rec.systemPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{fmtDate(p.date)}</TableCell>
                      <TableCell>
                        <div className="text-xs font-medium">{p.number} · {p.partyName}</div>
                        <div className="text-xs text-muted-foreground">{p.description || p.method}</div>
                      </TableCell>
                      <TableCell className={`text-right text-xs font-medium ${p.type === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {p.type === 'RECEIPT' ? '+' : '-'}{fmtMoney(p.amount, rec.currency)}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.isMatched ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Matched</Badge>
                        ) : selectedBankTx ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || isReadOnly}
                            onClick={() => matchTx(selectedBankTx, p.id)}
                          >
                            Match
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || isReadOnly}
                            onClick={() => matchTx(selectedBankTx || '')}
                            title="Match without payment"
                          >
                            Clear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedBankTx && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
          <Card className="shadow-lg">
            <CardContent className="flex items-center gap-3 p-3">
              <span className="text-sm">
                <strong>Selected:</strong> Click a payment to match, or
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || isReadOnly}
                onClick={() => matchTx(selectedBankTx)}
              >
                <X className="mr-1 h-3 w-3" /> Clear Without Payment
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedBankTx(null)}>Cancel</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
