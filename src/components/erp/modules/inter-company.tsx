'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeftRight, Plus, RefreshCw } from 'lucide-react'
import {
  fmtMoney,
  fmtDate,
  LoadingSpinner,
  EmptyState,
  PageHeader,
  useFetch,
} from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface BusinessLite {
  id: string
  name: string
  baseCurrency: string
}

interface AccountLite {
  id: string
  code: string
  name: string
  type: string
  subtype: string
}

interface InterCompanyTransfer {
  id: string
  date: string
  description: string
  reference: string | null
  amount: number
  fromBusiness: { id: string; name: string }
  toBusiness: { id: string; name: string }
  fromEntryId: string
  toEntryId: string | null
  isCurrentBusiness: boolean
}

export function InterCompanyModule(_: ModuleProps) {
  const [showForm, setShowForm] = React.useState(false)
  const { data: transfers, loading, refetch } = useFetch<InterCompanyTransfer[]>('/api/inter-company')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inter-Company Transfers"
        description="Move funds between businesses in your organization. Each transfer creates balanced journal entries in both businesses."
        actions={
          <>
            <Button variant="outline" onClick={refetch}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Transfer
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Transfer History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <LoadingSpinner message="Loading transfers..." />
          ) : !transfers || transfers.length === 0 ? (
            <EmptyState
              title="No inter-company transfers"
              description="Create your first transfer to move funds between businesses."
              action={{ label: 'New Transfer', onClick: () => setShowForm(true) }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>From Business</TableHead>
                  <TableHead>To Business</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{fmtDate(t.date)}</TableCell>
                    <TableCell className="font-medium">{t.fromBusiness.name}</TableCell>
                    <TableCell className="font-medium">{t.toBusiness.name}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-700 dark:text-emerald-400">
                      {fmtMoney(t.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.description || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.reference || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <InterCompanyTransferForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            refetch()
          }}
        />
      )}
    </div>
  )
}

function InterCompanyTransferForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const { data: businesses, loading: loadingBiz } = useFetch<BusinessLite[]>(
    '/api/tenant/businesses',
  )
  const [fromBusinessId, setFromBusinessId] = React.useState('')
  const [toBusinessId, setToBusinessId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0])
  const [fromAccountId, setFromAccountId] = React.useState('')
  const [toAccountId, setToAccountId] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  // Fetch accounts for each selected business
  const { data: fromAccounts } = useFetch<AccountLite[]>(
    fromBusinessId ? `/api/accounts?businessId=${fromBusinessId}` : '',
    [fromBusinessId],
  )
  const { data: toAccounts } = useFetch<AccountLite[]>(
    toBusinessId ? `/api/accounts?businessId=${toBusinessId}` : '',
    [toBusinessId],
  )

  // Filter to cash/bank accounts for the dropdowns
  const cashLike = (accs: AccountLite[] | null) =>
    (accs || []).filter(
      (a) => a.subtype === 'BANK' || a.subtype === 'CASH' || a.subtype === 'CURRENT_ASSET',
    )

  const handleSubmit = async () => {
    if (!fromBusinessId || !toBusinessId) {
      toast.error('Select both businesses')
      return
    }
    if (fromBusinessId === toBusinessId) {
      toast.error('From and to businesses must be different')
      return
    }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount greater than zero')
      return
    }
    if (!fromAccountId || !toAccountId) {
      toast.error('Select cash/bank accounts for both businesses')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/inter-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromBusinessId,
          toBusinessId,
          amount: amt,
          description,
          date,
          fromAccountId,
          toAccountId,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Inter-company transfer created')
        onSaved()
      } else {
        toast.error(data.error || 'Failed to create transfer')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create transfer')
    } finally {
      setSaving(false)
    }
  }

  if (loadingBiz) return <LoadingSpinner message="Loading businesses..." />

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>New Inter-Company Transfer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Business *</Label>
              <Select
                value={fromBusinessId}
                onValueChange={(v) => {
                  setFromBusinessId(v)
                  setFromAccountId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.baseCurrency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Business *</Label>
              <Select
                value={toBusinessId}
                onValueChange={(v) => {
                  setToBusinessId(v)
                  setToAccountId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.baseCurrency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>From Account (Cash/Bank) *</Label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cash/bank account" />
                </SelectTrigger>
                <SelectContent>
                  {cashLike(fromAccounts).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Account (Cash/Bank) *</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cash/bank account" />
                </SelectTrigger>
                <SelectContent>
                  {cashLike(toAccounts).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Working capital injection"
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Journal entries to be created:</p>
            <ul className="mt-1 space-y-1">
              <li>• From business: <strong>Dr Inter-Company Receivable</strong> / <strong>Cr Cash/Bank</strong></li>
              <li>• To business: <strong>Dr Cash/Bank</strong> / <strong>Cr Inter-Company Payable</strong></li>
            </ul>
          </div>
        </CardContent>
        <div className="flex justify-end gap-2 p-4 pt-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Creating…
              </>
            ) : (
              <>
                <ArrowLeftRight className="mr-2 h-4 w-4" /> Create Transfer
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
