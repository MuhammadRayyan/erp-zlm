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
import { Plus, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, useFetch, PageHeader, useBusiness } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Payment { id: string; number: string; date: string; type: string; partyName: string; amount: number; method: string; reference: string | null; description: string | null; status: string; currency: string }
interface Party { id: string; name: string; type: string }
interface BankAccount { id: string; name: string }
interface Invoice { id: string; number: string; total: number; amountPaid: number; balanceDue: number }

export function PaymentsModule({ navigate, searchParams }: ModuleProps) {
  const { business } = useBusiness()
  const action = searchParams.get('action')
  if (action === 'new') return <PaymentForm business={business} navigate={navigate} preselectInvoiceId={searchParams.get('invoiceId')} />
  return <PaymentList business={business} navigate={navigate} />
}

function PaymentList({ navigate }: ModuleProps) {
  const { data: payments, loading } = useFetch<Payment[]>('/api/payments')
  const [typeFilter, setTypeFilter] = React.useState('ALL')
  if (loading) return <LoadingSpinner message="Loading payments..." />
  const filtered = (payments || []).filter(p => typeFilter === 'ALL' || p.type === typeFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Payments</h2><p className="text-sm text-muted-foreground">Receipts from customers and payments to suppliers</p></div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('payments', { action: 'new', ptype: 'RECEIPT' })}><ArrowDownCircle className="mr-2 h-4 w-4" /> Receive</Button>
          <Button onClick={() => navigate('payments', { action: 'new', ptype: 'PAYMENT' })}><ArrowUpCircle className="mr-2 h-4 w-4" /> Pay</Button>
        </div>
      </div>
      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-40"><SelectValue placeholder="All types" /></SelectTrigger>
        <SelectContent><SelectItem value="ALL">All types</SelectItem><SelectItem value="RECEIPT">Receipts</SelectItem><SelectItem value="PAYMENT">Payments</SelectItem></SelectContent>
      </Select>
      {filtered.length === 0 ? (
        <EmptyState title="No payments" description="Record your first payment." action={{ label: 'New Payment', onClick: () => navigate('payments', { action: 'new' }) }} />
      ) : (
        <Card><CardContent className="p-0"><Table>
          <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Party</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.map(p => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.number}</TableCell><TableCell>{fmtDate(p.date)}</TableCell>
              <TableCell><span className={p.type === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'}>{p.type}</span></TableCell>
              <TableCell>{p.partyName}</TableCell><TableCell className="text-xs">{p.method}</TableCell>
              <TableCell className={`text-right font-medium ${p.type === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'}`}>{p.type === 'RECEIPT' ? '+' : '-'}{fmtMoney(p.amount, p.currency)}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table></CardContent></Card>
      )}
    </div>
  )
}

function PaymentForm({ navigate, preselectInvoiceId }: ModuleProps & { preselectInvoiceId?: string | null }) {
  const { business } = useBusiness()
  const { data: parties } = useFetch<Party[]>('/api/parties')
  const { data: bankAccounts } = useFetch<BankAccount[]>('/api/banking')
  const [type, setType] = React.useState<'RECEIPT' | 'PAYMENT'>(preselectInvoiceId ? 'RECEIPT' : 'RECEIPT')
  const [partyId, setPartyId] = React.useState('')
  const [amount, setAmount] = React.useState(0)
  const [date, setDate] = React.useState(new Date().toISOString().split('T')[0])
  const [method, setMethod] = React.useState('CASH')
  const [reference, setReference] = React.useState('')
  const [bankAccountId, setBankAccountId] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [allocations, setAllocations] = React.useState<{ invoiceId: string; billId?: string; amount: number; number: string }[]>([])
  const [availableInvoices, setAvailableInvoices] = React.useState<Invoice[]>([])
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (partyId) {
      const t = type === 'RECEIPT' ? 'CUSTOMER' : 'SUPPLIER'
      fetch(`/api/${type === 'RECEIPT' ? 'invoices' : 'bills'}?partyId=${partyId}`)
        .then(r => r.json())
        .then(d => setAvailableInvoices((d || []).filter((x: Invoice) => x.balanceDue > 0)))
    }
  }, [partyId, type])

  const filteredParties = (parties || []).filter(p => type === 'RECEIPT' ? (p.type === 'CUSTOMER' || p.type === 'BOTH') : (p.type === 'SUPPLIER' || p.type === 'BOTH'))

  const allocate = (inv: Invoice) => {
    setAllocations([...allocations.filter(a => a.invoiceId !== inv.id && a.billId !== inv.id), {
      [type === 'RECEIPT' ? 'invoiceId' : 'billId']: inv.id, amount: Math.min(inv.balanceDue, amount - allocations.reduce((s, a) => s + a.amount, 0)), number: inv.number,
    } as { invoiceId: string; billId?: string; amount: number; number: string }])
  }

  const save = async () => {
    if (!partyId) { toast.error('Select a party'); return }
    if (amount <= 0) { toast.error('Amount must be positive'); return }
    setSaving(true)
    const res = await fetch('/api/payments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, partyId, amount, date, method, reference, bankAccountId: bankAccountId || undefined, description, allocations: allocations.filter(a => a.amount > 0).map(a => ({ invoiceId: a.invoiceId, billId: a.billId, amount: a.amount })) }),
    })
    if (res.ok) { toast.success('Payment recorded'); navigate('payments') }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
    setSaving(false)
  }

  const currency = business?.baseCurrency || 'AED'

  return (
    <div className="space-y-6">
      <PageHeader title={type === 'RECEIPT' ? 'Receive Payment' : 'Make Payment'} onBack={() => navigate('payments')} />
      <Card><CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Type</Label><Select value={type} onValueChange={v => setType(v as 'RECEIPT' | 'PAYMENT')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RECEIPT">Receipt (from Customer)</SelectItem><SelectItem value="PAYMENT">Payment (to Supplier)</SelectItem></SelectContent></Select></div>
          <div><Label>{type === 'RECEIPT' ? 'Customer' : 'Supplier'} *</Label><Select value={partyId} onValueChange={setPartyId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{filteredParties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Amount *</Label><Input type="number" step="0.01" value={amount || ''} onChange={e => setAmount(parseFloat(e.target.value) || 0)} /></div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Method</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="CHEQUE">Cheque</SelectItem><SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="ONLINE">Online</SelectItem></SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Cheque no, Txn ID..." /></div>
          <div><Label>Bank Account</Label><Select value={bankAccountId || 'NONE'} onValueChange={v => setBankAccountId(v === 'NONE' ? '' : v)}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value="NONE">None (Cash)</SelectItem>{bankAccounts?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
      </CardContent></Card>

      {partyId && availableInvoices.length > 0 && (
        <Card><CardContent className="p-5">
          <h3 className="mb-3 font-semibold">Allocate to {type === 'RECEIPT' ? 'Invoices' : 'Bills'}</h3>
          <Table><TableHeader><TableRow><TableHead>Number</TableHead><TableHead className="text-right">Balance Due</TableHead><TableHead className="text-right">Allocate</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
            <TableBody>{availableInvoices.map(inv => {
              const alloc = allocations.find(a => a.invoiceId === inv.id || a.billId === inv.id)
              return <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.number}</TableCell>
                <TableCell className="text-right">{fmtMoney(inv.balanceDue, currency)}</TableCell>
                <TableCell className="text-right"><Input type="number" step="0.01" className="w-28 ml-auto" value={alloc?.amount || ''} onChange={e => { const amt = parseFloat(e.target.value) || 0; if (amt > inv.balanceDue) { toast.error('Cannot exceed balance'); return } setAllocations(alloc ? allocations.map(a => a === alloc ? { ...a, amount: amt } : a) : [...allocations, { [type === 'RECEIPT' ? 'invoiceId' : 'billId']: inv.id, amount: amt, number: inv.number } as { invoiceId: string; billId?: string; amount: number; number: string }]) }} /></TableCell>
                <TableCell>{!alloc && <Button size="sm" variant="ghost" onClick={() => allocate(inv)}>Auto</Button>}</TableCell>
              </TableRow>
            })}</TableBody>
          </Table>
        </CardContent></Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('payments')}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Record Payment'}</Button>
      </div>
    </div>
  )
}
