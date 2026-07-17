'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Save, Send, ArrowLeft, Printer, FileText, Search } from 'lucide-react'
import { fmtMoney, fmtDate, fmtNumber, StatusBadge, LoadingSpinner, EmptyState, useFetch, PageHeader, useBusiness } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

interface Invoice {
  id: string
  number: string
  date: string
  dueDate: string
  partyId: string
  partyName: string
  reference: string | null
  subtotal: number
  totalTax: number
  total: number
  amountPaid: number
  balanceDue: number
  status: string
  currency: string
  notes: string | null
  terms: string | null
  lines: InvoiceLine[]
}

interface InvoiceLine {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxRateId?: string | null
  taxRate?: number
  lineTotal: number
  lineTax: number
  total: number
}

interface Party { id: string; name: string }
interface TaxRate { id: string; name: string; rate: number; category: string; isDefault?: boolean }

export function InvoicesModule({ navigate, searchParams }: ModuleProps) {
  const { business } = useBusiness()
  const action = searchParams.get('action')
  const editId = searchParams.get('id')

  if (action === 'new' || action === 'edit') {
    return <InvoiceForm business={business} navigate={navigate} editId={action === 'edit' ? editId || undefined : undefined} />
  }
  if (action === 'view' && editId) {
    return <InvoiceView business={business} navigate={navigate} id={editId} />
  }

  return <InvoiceList business={business} navigate={navigate} />
}

function InvoiceList({ navigate }: any) {
  const { data: invoices, loading, refetch } = useFetch<Invoice[]>('/api/invoices')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('ALL')

  const invoiceList = Array.isArray(invoices) ? invoices : (invoices as any)?.items || []
  const filtered = invoiceList.filter((inv: Invoice) =>
    (inv.number.toLowerCase().includes(search.toLowerCase()) || inv.partyName.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'ALL' || inv.status === statusFilter)
  )

  if (loading) return <LoadingSpinner message="Loading invoices..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Invoices</h2>
          <p className="text-sm text-muted-foreground">Create and manage sales invoices with UAE VAT</p>
        </div>
        <Button onClick={() => navigate('invoices', { action: 'new' })}>
          <Plus className="mr-2 h-4 w-4" /> New Invoice
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
            <SelectItem value="OVERDUE">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No invoices" description="Create your first sales invoice." action={{ label: 'New Invoice', onClick: () => navigate('invoices', { action: 'new' }) }} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right table-nums">Total</TableHead>
                  <TableHead className="text-right table-nums">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inv => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate('invoices', { action: 'view', id: inv.id })}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{fmtDate(inv.date)}</TableCell>
                    <TableCell>{inv.partyName}</TableCell>
                    <TableCell>{fmtDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right font-medium table-nums">{fmtMoney(inv.total, inv.currency)}</TableCell>
                    <TableCell className="text-right table-nums">{fmtMoney(inv.balanceDue, inv.currency)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InvoiceForm({ navigate, editId }: any & { editId?: string }) {
  const { business } = useBusiness()
  const { data: parties } = useFetch<Party[]>('/api/parties?type=CUSTOMER')
  const { data: taxRates } = useFetch<TaxRate[]>('/api/tax-rates')
  const { data: items } = useFetch<{ id: string; name: string; sku: string; salePrice: number; description: string | null }[]>('/api/items')
  const { data: editInvoice } = useFetch<Invoice>(editId ? `/api/invoices?id=${editId}` : '', [editId])

  const [form, setForm] = React.useState<{
    partyId: string
    date: string
    dueDate: string
    reference: string
    notes: string
    terms: string
    lines: InvoiceLine[]
  } | null>(null)

  React.useEffect(() => {
    if (editId && editInvoice) {
      setForm({
        partyId: editInvoice.partyId,
        date: editInvoice.date.split('T')[0],
        dueDate: editInvoice.dueDate.split('T')[0],
        reference: editInvoice.reference || '',
        notes: editInvoice.notes || '',
        terms: editInvoice.terms || '',
        lines: editInvoice.lines.map(l => ({
          id: l.id, description: l.description, quantity: l.quantity,
          unitPrice: l.unitPrice, discount: l.discount,
          taxRateId: l.taxRateId, taxRate: (l as any).taxRate?.rate || (business?.vatRegistered ? Number(business.vatRate) : 0),
          lineTotal: l.lineTotal, lineTax: l.lineTax, total: l.lineTotal + l.lineTax,
        })),
      })
    } else if (!editId && !form) {
      const today = new Date().toISOString().split('T')[0]
      const due = new Date(); due.setDate(due.getDate() + 30)
      setForm({
        partyId: '', date: today, dueDate: due.toISOString().split('T')[0],
        reference: '', notes: '', terms: '',
        lines: [{ description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: business?.vatRegistered ? Number(business.vatRate) : 0, lineTotal: 0, lineTax: 0, total: 0 }],
      })
    }
  }, [editId, editInvoice, business, form])

  const [saving, setSaving] = React.useState(false)
  const [showPostConfirm, setShowPostConfirm] = React.useState(false)

  if (editId && !editInvoice) return <LoadingSpinner message="Loading invoice..." />
  if (!form) return <LoadingSpinner />

  const vatRate = business?.vatRegistered ? Number(business.vatRate) : 0
  const defaultTaxRate = taxRates?.find(t => t.isDefault)

  const calcLine = (line: InvoiceLine) => {
    const gross = line.quantity * line.unitPrice
    const discountAmt = gross * (line.discount / 100)
    const net = gross - discountAmt
    const tax = net * ((line.taxRate ?? vatRate) / 100)
    return { ...line, lineTotal: net, lineTax: tax, total: net + tax }
  }

  const updatedLines = form.lines.map(l => {
    const tr = taxRates?.find(t => t.id === l.taxRateId)
    return calcLine({ ...l, taxRate: tr?.rate ?? vatRate })
  })

  const subtotal = updatedLines.reduce((s, l) => s + l.lineTotal, 0)
  const totalTax = updatedLines.reduce((s, l) => s + l.lineTax, 0)
  const total = subtotal + totalTax
  const currency = business?.baseCurrency || 'AED'

  const addLine = () => {
    setForm({ ...form, lines: [...form.lines, { description: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: vatRate, lineTotal: 0, lineTax: 0, total: 0 }] })
  }

  const removeLine = (i: number) => {
    setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) })
  }

  const updateLine = (i: number, field: keyof InvoiceLine, value: string | number) => {
    const lines = [...form.lines]
    const line = { ...lines[i], [field]: value }
    lines[i] = line
    setForm({ ...form, lines })
  }

  const handleItemSelect = (i: number, itemId: string) => {
    const item = items?.find(it => it.id === itemId)
    if (item) {
      const lines = [...form.lines]
      lines[i] = { ...lines[i], description: item.description || item.name, unitPrice: item.salePrice }
      setForm({ ...form, lines })
    }
  }

  const save = async (post: boolean) => {
    if (!form.partyId) { toast.error('Please select a customer'); return }
    if (form.lines.length === 0 || !form.lines[0].description) { toast.error('Add at least one line item'); return }

    const body = {
      partyId: form.partyId,
      date: form.date,
      dueDate: form.dueDate,
      reference: form.reference,
      notes: form.notes,
      terms: form.terms,
      post,
      lines: form.lines.map(l => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        taxRateId: l.taxRateId,
        taxRate: l.taxRate,
      })),
    }

    const url = editId ? `/api/invoices?id=${editId}` : '/api/invoices'
    const method = editId ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const saved = await res.json()
      toast.success(post ? 'Invoice posted' : 'Invoice saved as draft')
      navigate('invoices', { action: 'view', id: saved.id })
    } else {
      const e = await res.json()
      toast.error(e.error || 'Failed to save')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={editId ? `Edit ${editInvoice?.number || 'Invoice'}` : 'New Invoice'}
        onBack={() => navigate('invoices')}
        actions={
          <>
            <Button variant="outline" onClick={() => save(false)}><Save className="mr-2 h-4 w-4" /> Save Draft</Button>
            <Button onClick={() => setShowPostConfirm(true)}><Send className="mr-2 h-4 w-4" /> Review & Post</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select value={form.partyId} onValueChange={v => setForm({ ...form, partyId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {parties?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference / PO No.</Label>
                <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/30">
              <p className="text-xs text-muted-foreground">VAT Rate</p>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{vatRate}% Standard Rate</p>
              <p className="mt-1 text-xs text-muted-foreground">UAE FTA compliant</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line items */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Line Items</h3>
            <Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1 h-4 w-4" /> Add Line</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Description</TableHead>
                  <TableHead className="w-20">Qty</TableHead>
                  <TableHead className="w-28">Unit Price</TableHead>
                  <TableHead className="w-20">Disc %</TableHead>
                  <TableHead className="w-28">Tax Rate</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {updatedLines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          value={line.description}
                          onChange={e => updateLine(i, 'description', e.target.value)}
                          placeholder="Item description"
                        />
                        {items && items.length > 0 && (
                          <Select onValueChange={v => handleItemSelect(i, v)}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pick from inventory" /></SelectTrigger>
                            <SelectContent>
                              {items.map(it => <SelectItem key={it.id} value={it.id}>{it.sku} - {it.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-20" value={line.quantity} onChange={e => updateLine(i, 'quantity', parseFloat(e.target.value) || 0)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-28" value={line.unitPrice} onChange={e => updateLine(i, 'unitPrice', parseFloat(e.target.value) || 0)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-20" value={line.discount} onChange={e => updateLine(i, 'discount', parseFloat(e.target.value) || 0)} /></TableCell>
                    <TableCell>
                      <Select value={line.taxRateId || `_rate_${line.taxRate}`} onValueChange={v => {
                        if (v.startsWith('_rate_')) return
                        updateLine(i, 'taxRateId', v)
                      }}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={`_rate_${vatRate}`}>VAT {vatRate}%</SelectItem>
                          <SelectItem value={`_rate_0`}>No Tax (0%)</SelectItem>
                          {taxRates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.rate}%)</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-medium table-nums">{fmtMoney(line.total, currency)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => removeLine(i)} disabled={form.lines.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{fmtMoney(subtotal, currency)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT ({vatRate}%)</span><span className="font-medium">{fmtMoney(totalTax, currency)}</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-emerald-700 dark:text-emerald-400">{fmtMoney(total, currency)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Post Confirmation Dialog */}
      <AlertDialog open={showPostConfirm} onOpenChange={setShowPostConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Posting this invoice will create permanent journal entries and cannot be undone. 
              Corrections must be made via credit notes.
              <br /><br />
              <strong>Customer:</strong> {parties?.find(p => p.id === form.partyId)?.name || '—'}<br />
              <strong>Date:</strong> {form.date}<br />
              <strong>Subtotal:</strong> {fmtMoney(subtotal, currency)}<br />
              <strong>VAT:</strong> {fmtMoney(totalTax, currency)}<br />
              <strong>Total:</strong> {fmtMoney(total, currency)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowPostConfirm(false); save(true) }}>
              Yes, Post Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notes & Terms */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <Label>Notes (visible on invoice)</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Thank you for your business!" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Label>Terms & Conditions</Label>
            <Textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} rows={3} placeholder="Payment due within 30 days..." />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InvoiceView({ navigate, id }: any & { id: string }) {
  const { business } = useBusiness()
  const { data: invoice, loading } = useFetch<Invoice>(`/api/invoices?id=${id}`, [id])
  const [showPdf, setShowPdf] = React.useState(false)

  if (loading || !invoice) return <LoadingSpinner message="Loading invoice..." />

  const currency = invoice.currency || business?.baseCurrency || 'AED'

  const handlePost = async () => {
    console.log('handlePost invoked for id:', id);
    try {
      const res = await fetch('/api/invoices/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', id }),
      })
      if (res.ok) { toast.success('Invoice posted'); window.location.reload() }
      else { const e = await res.json(); toast.error(e.error || 'Failed') }
    } catch (err) {
      console.error('handlePost Error:', err);
      toast.error('Network error while posting');
    }
  }

  const handleVoid = async () => {
    if (!confirm('Void this invoice? This will reverse all journal entries.')) return
    const res = await fetch('/api/invoices/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'void', id }),
    })
    if (res.ok) { toast.success('Invoice voided'); navigate('invoices') }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Invoice ${invoice.number}`}
        onBack={() => navigate('invoices')}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowPdf(!showPdf)}><Printer className="mr-2 h-4 w-4" /> {showPdf ? 'Hide Preview' : 'Preview PDF'}</Button>
            {invoice.status === 'DRAFT' && <Button variant="outline" onClick={() => navigate('invoices', { action: 'edit', id })}>Edit</Button>}
            {invoice.status === 'DRAFT' && <Button onClick={handlePost}><Send className="mr-2 h-4 w-4" /> Post</Button>}
            {(invoice.status === 'POSTED' || invoice.status === 'PARTIALLY_PAID' || invoice.status === 'OVERDUE') && (
              <Button variant="outline" className="text-red-600" onClick={handleVoid}>Void</Button>
            )}
          </>
        }
      />

      {showPdf ? (
        <PdfPreview doctype="SALES_INVOICE" documentId={id} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <h3 className="text-xl font-bold">{business?.name}</h3>
                    {business?.legalName && <p className="text-sm text-muted-foreground">{business.legalName}</p>}
                    {business?.addressLine1 && <p className="text-sm text-muted-foreground">{business.addressLine1}</p>}
                    {business?.trn && <p className="mt-1 text-sm font-medium">TRN: {business.trn}</p>}
                  </div>
                  <div className="text-right table-nums">
                    <h2 className="text-2xl font-bold uppercase tracking-wide">Invoice</h2>
                    <p className="mt-1 font-semibold text-emerald-600">{invoice.number}</p>
                    <p className="text-sm text-muted-foreground">{fmtDate(invoice.date)}</p>
                    <div className="mt-2"><StatusBadge status={invoice.status} /></div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Bill To</p>
                    <p className="mt-1 font-semibold">{invoice.partyName}</p>
                    {invoice.reference && <p className="text-sm text-muted-foreground">Ref: {invoice.reference}</p>}
                  </div>
                  <div className="text-right table-nums">
                    <p className="text-xs uppercase text-muted-foreground">Due Date</p>
                    <p className="mt-1 font-semibold">{fmtDate(invoice.dueDate)}</p>
                  </div>
                </div>

                <Table className="mt-6">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right table-nums">Qty</TableHead>
                      <TableHead className="text-right table-nums">Price</TableHead>
                      <TableHead className="text-right table-nums">Disc%</TableHead>
                      <TableHead className="text-right table-nums">Tax%</TableHead>
                      <TableHead className="text-right table-nums">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lines.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell>{l.description}</TableCell>
                        <TableCell className="text-right table-nums">{fmtNumber(l.quantity)}</TableCell>
                        <TableCell className="text-right table-nums">{fmtMoney(l.unitPrice, currency)}</TableCell>
                        <TableCell className="text-right table-nums">{l.discount}%</TableCell>
                        <TableCell className="text-right table-nums">{(l as any).taxRate?.rate ?? 0}%</TableCell>
                        <TableCell className="text-right font-medium table-nums">{fmtMoney(l.lineTotal + l.lineTax, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-4 flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmtMoney(invoice.subtotal, currency)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">VAT</span><span>{fmtMoney(invoice.totalTax, currency)}</span></div>
                    <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="text-emerald-700 dark:text-emerald-400">{fmtMoney(invoice.total, currency)}</span></div>
                    {invoice.amountPaid > 0 && <>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span>-{fmtMoney(invoice.amountPaid, currency)}</span></div>
                      <div className="flex justify-between font-semibold"><span>Balance Due</span><span>{fmtMoney(invoice.balanceDue, currency)}</span></div>
                    </>}
                  </div>
                </div>

                {invoice.notes && <div className="mt-6 rounded-lg bg-muted p-3 text-sm"><p className="font-semibold">Notes</p><p className="mt-1 text-muted-foreground">{invoice.notes}</p></div>}
                {invoice.terms && <div className="mt-2 rounded-lg bg-muted p-3 text-sm"><p className="font-semibold">Terms</p><p className="mt-1 text-muted-foreground">{invoice.terms}</p></div>}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold">Payment Status</h3>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Invoice Total</span><span className="font-medium">{fmtMoney(invoice.total, currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span className="font-medium">{fmtMoney(invoice.amountPaid, currency)}</span></div>
                  <div className="flex justify-between border-t pt-2"><span className="font-semibold">Balance Due</span><span className="font-bold text-emerald-700 dark:text-emerald-400">{fmtMoney(invoice.balanceDue, currency)}</span></div>
                </div>
                {invoice.balanceDue > 0 && invoice.status !== 'DRAFT' && (
                  <Button className="mt-4 w-full" onClick={() => navigate('payments', { action: 'new', invoiceId: id })}>
                    Record Payment
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// PDF preview component (reused)
export function PdfPreview({ doctype, documentId }: { doctype: string; documentId: string }) {
  const [html, setHtml] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/templates/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctype, documentId }),
    })
      .then(r => r.json())
      .then(d => setHtml(d.html))
      .finally(() => setLoading(false))
  }, [doctype, documentId])

  if (loading) return <LoadingSpinner message="Rendering PDF preview..." />

  const printPdf = () => {
    const w = window.open('', '_blank')
    if (w && html) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 500)
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex justify-end">
          <Button onClick={printPdf}><Printer className="mr-2 h-4 w-4" /> Print / Save as PDF</Button>
        </div>
        <iframe srcDoc={html || undefined} className="h-[600px] w-full rounded border" title="PDF Preview" />
      </CardContent>
    </Card>
  )
}
