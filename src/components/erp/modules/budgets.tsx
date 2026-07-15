'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, PieChart, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fmtMoney, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

type BudgetPeriod = 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

interface Budget {
  id: string
  name: string
  fiscalYear: number
  accountId: string | null
  account: { code: string; name: string; type: string } | null
  period: BudgetPeriod
  amount: number
  actualAmount: number
  variance: number
  pctUsed: number
}

interface Account { id: string; code: string; name: string; type: string }

export function BudgetsModule(_props: ModuleProps) {
  const [fiscalYear, setFiscalYear] = React.useState<number>(new Date().getFullYear())
  const { data: budgets, loading, refetch } = useFetch<Budget[]>(`/api/budgets?fiscalYear=${fiscalYear}`, [fiscalYear])
  const [showForm, setShowForm] = React.useState(false)

  // Aggregate totals across the fiscal year
  const totals = React.useMemo(() => {
    if (!budgets || budgets.length === 0) return { budget: 0, actual: 0, variance: 0 }
    const budget = budgets.reduce((s, b) => s + b.amount, 0)
    const actual = budgets.reduce((s, b) => s + b.actualAmount, 0)
    return { budget, actual, variance: budget - actual }
  }, [budgets])

  const remove = async (id: string) => {
    if (!confirm('Delete this budget?')) return
    const res = await fetch(`/api/budgets?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Budget deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  if (loading) return <LoadingSpinner message="Loading budgets..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Budgets</h2>
          <p className="text-sm text-muted-foreground">Set budgets and compare against actuals</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(fiscalYear)} onValueChange={v => setFiscalYear(parseInt(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - 2 + i
                return <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              })}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> New Budget</Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Budgeted"
          value={fmtMoney(totals.budget)}
          icon={PieChart}
          color="bg-blue-500"
        />
        <SummaryCard
          title="Total Actual"
          value={fmtMoney(totals.actual)}
          icon={totals.actual <= totals.budget ? TrendingUp : TrendingDown}
          color={totals.actual <= totals.budget ? 'bg-emerald-500' : 'bg-red-500'}
        />
        <SummaryCard
          title="Variance"
          value={fmtMoney(totals.variance)}
          icon={totals.variance >= 0 ? TrendingUp : Minus}
          color={totals.variance >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}
          subtitle={totals.budget > 0 ? `${Math.round((totals.actual / totals.budget) * 100)}% used` : undefined}
        />
      </div>

      {!budgets || budgets.length === 0 ? (
        <EmptyState
          title={`No budgets for FY ${fiscalYear}`}
          description="Create your first budget to track spending against plan."
          action={{ label: 'New Budget', onClick: () => setShowForm(true) }}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual — FY {fiscalYear}</CardTitle>
            <CardDescription>Compare planned budgets to actual posted amounts for the fiscal year.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="w-40">% Used</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      {b.account ? (
                        <div className="flex flex-col">
                          <span className="text-sm">{b.account.code} - {b.account.name}</span>
                          <span className="text-xs text-muted-foreground">{b.account.type}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">— General —</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{b.period.toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(b.amount)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(b.actualAmount)}</TableCell>
                    <TableCell className="text-right">
                      <VarianceBadge variance={b.variance} pctUsed={b.pctUsed} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(100, Math.max(0, b.pctUsed))}
                          className="h-2"
                        // color is set by parent's text color
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{b.pctUsed.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => remove(b.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showForm && <BudgetForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch() }} defaultYear={fiscalYear} />}
    </div>
  )
}

// ============================================================
// Create form
// ============================================================

function BudgetForm({ onClose, onSaved, defaultYear }: { onClose: () => void; onSaved: () => void; defaultYear: number }) {
  const { data: accounts } = useFetch<Account[]>('/api/accounts')
  const [name, setName] = React.useState('')
  const [fiscalYear, setFiscalYear] = React.useState<number>(defaultYear)
  const [accountId, setAccountId] = React.useState<string>('')
  const [period, setPeriod] = React.useState<BudgetPeriod>('YEARLY')
  const [amount, setAmount] = React.useState<number>(0)
  const [saving, setSaving] = React.useState(false)

  // Group accounts by type for easier selection
  const accountsByType = React.useMemo(() => {
    const groups: Record<string, Account[]> = {}
    for (const a of accounts || []) {
      const t = a.type
      if (!groups[t]) groups[t] = []
      groups[t].push(a)
    }
    return groups
  }, [accounts])

  const save = async () => {
    if (!name) { toast.error('Name required'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, fiscalYear,
          accountId: accountId || null,
          period, amount,
        }),
      })
      if (res.ok) { toast.success('Budget created'); onSaved() }
      else { const e = await res.json(); toast.error(e.error || 'Failed') }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Budget</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Budget Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. 2025 Marketing Budget" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fiscal Year</Label>
              <Input type="number" value={fiscalYear} onChange={e => setFiscalYear(parseInt(e.target.value) || defaultYear)} />
            </div>
            <div>
              <Label>Period</Label>
              <Select value={period} onValueChange={(v: BudgetPeriod) => setPeriod(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Account (optional — leave blank for overall budget)</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="— General (no specific account) —" /></SelectTrigger>
              <SelectContent>
                {Object.keys(accountsByType).length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No accounts available</div>
                )}
                {Object.entries(accountsByType).flatMap(([type, accs]) => [
                  // Disabled group header — Radix Select requires non-empty value
                  <SelectItem key={`__group_${type}`} value={`__group_${type}`} disabled className="font-semibold">
                    {type}
                  </SelectItem>,
                  ...accs.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  )),
                ])}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Budget Amount</Label>
            <Input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name}>{saving ? 'Saving...' : 'Create Budget'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Sub-components
// ============================================================

function SummaryCard({ title, value, icon: Icon, color, subtitle }: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  subtitle?: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg text-white ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function VarianceBadge({ variance, pctUsed }: { variance: number; pctUsed: number }) {
  const absVariance = Math.abs(variance)
  const cls = pctUsed > 100
    ? 'text-red-600'
    : pctUsed > 90
      ? 'text-amber-600'
      : 'text-emerald-600'
  return (
    <div className="flex items-center justify-end gap-1">
      <span className={`text-sm font-medium ${cls}`}>
        {variance >= 0 ? '+' : '-'}{fmtMoney(absVariance)}
      </span>
    </div>
  )
}
