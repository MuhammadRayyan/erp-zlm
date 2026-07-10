'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Pencil, Trash2, Search, Phone, Mail, MapPin } from 'lucide-react'
import { UAE_EMIRATES } from '@/lib/constants'
import { fmtMoney, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Party {
  id: string
  code: string | null
  name: string
  nameAr: string | null
  type: string
  trn: string | null
  email: string | null
  phone: string | null
  contactPerson: string | null
  city: string | null
  state: string | null
  country: string
  paymentTerms: number
  creditLimit: number
  openingBalance: number
  openingBalanceType: string
  notes: string | null
  isActive: boolean
  billingAddress1: string | null
  billingCity: string | null
  billingState: string | null
  billingCountry: string
  shippingAddress1: string | null
  shippingCity: string | null
}

export function PartiesModule({ partyType, navigate }: ModuleProps & { partyType: 'CUSTOMER' | 'SUPPLIER' }) {
  const { data: parties, loading, refetch } = useFetch<Party[]>(`/api/parties?type=${partyType}`)
  const [search, setSearch] = React.useState('')
  const [showForm, setShowForm] = React.useState(false)
  const [editing, setEditing] = React.useState<Party | null>(null)

  const isCustomer = partyType === 'CUSTOMER'

  const filtered = (parties || []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase()) ||
    p.trn?.includes(search)
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this party?')) return
    const res = await fetch(`/api/parties?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); refetch() }
    else toast.error('Failed to delete')
  }

  if (loading) return <LoadingSpinner message={`Loading ${isCustomer ? 'customers' : 'suppliers'}...`} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{isCustomer ? 'Customers' : 'Suppliers'}</h2>
          <p className="text-sm text-muted-foreground">Manage your {isCustomer ? 'customers' : 'suppliers'} with TRN and addresses</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="mr-2 h-4 w-4" /> New {isCustomer ? 'Customer' : 'Supplier'}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, code, or TRN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={`No ${isCustomer ? 'customers' : 'suppliers'} yet`}
          description={`Add your first ${isCustomer ? 'customer' : 'supplier'} to start creating ${isCustomer ? 'invoices' : 'bills'}.`}
          action={{ label: `Add ${isCustomer ? 'Customer' : 'Supplier'}`, onClick: () => { setEditing(null); setShowForm(true) } }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>TRN</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code || '—'}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.contactPerson && <div className="text-xs text-muted-foreground">{p.contactPerson}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.trn || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs">
                        {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                        {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{p.city || '—'}{p.state ? `, ${p.state}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{p.creditLimit > 0 ? fmtMoney(p.creditLimit) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(p); setShowForm(true) }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <PartyForm
          party={editing}
          defaultType={partyType}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); refetch() }}
        />
      )}
    </div>
  )
}

function PartyForm({ party, defaultType, onClose, onSaved }: {
  party: Party | null
  defaultType: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = React.useState({
    code: party?.code || '',
    name: party?.name || '',
    nameAr: party?.nameAr || '',
    type: party?.type || defaultType,
    trn: party?.trn || '',
    email: party?.email || '',
    phone: party?.phone || '',
    website: party?.website || '',
    contactPerson: party?.contactPerson || '',
    billingAddress1: party?.billingAddress1 || '',
    billingAddress2: party?.billingAddress2 || '',
    billingCity: party?.billingCity || '',
    billingState: party?.billingState || '',
    billingPostalCode: party?.billingPostalCode || '',
    billingCountry: party?.billingCountry || 'AE',
    shippingAddress1: party?.shippingAddress1 || '',
    shippingAddress2: party?.shippingAddress2 || '',
    shippingCity: party?.shippingCity || '',
    shippingState: party?.shippingState || '',
    shippingPostalCode: party?.shippingPostalCode || '',
    shippingCountry: party?.shippingCountry || 'AE',
    paymentTerms: party?.paymentTerms ?? 30,
    creditLimit: party?.creditLimit || 0,
    openingBalance: party?.openingBalance || 0,
    openingBalanceType: party?.openingBalanceType || 'DEBIT',
    notes: party?.notes || '',
    isActive: party?.isActive ?? true,
  })
  const [saving, setSaving] = React.useState(false)

  const copyBillingToShipping = () => {
    setForm({
      ...form,
      shippingAddress1: form.billingAddress1,
      shippingAddress2: form.billingAddress2,
      shippingCity: form.billingCity,
      shippingState: form.billingState,
      shippingPostalCode: form.billingPostalCode,
      shippingCountry: form.billingCountry,
    })
  }

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const url = party ? `/api/parties?id=${party.id}` : '/api/parties'
      const method = party ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (res.ok) { toast.success(party ? 'Updated' : 'Created'); onSaved() }
      else { const e = await res.json(); toast.error(e.error || 'Failed') }
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{party ? 'Edit' : 'New'} {defaultType === 'CUSTOMER' ? 'Customer' : 'Supplier'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Name (Arabic)</Label><Input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>TRN (15 digits)</Label><Input value={form.trn} onChange={e => setForm({ ...form, trn: e.target.value })} placeholder="100000000000003" maxLength={15} /></div>
              <div><Label>Contact Person</Label><Input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></div>
          </TabsContent>

          <TabsContent value="billing" className="space-y-3 mt-4">
            <div><Label>Address Line 1</Label><Input value={form.billingAddress1} onChange={e => setForm({ ...form, billingAddress1: e.target.value })} /></div>
            <div><Label>Address Line 2</Label><Input value={form.billingAddress2} onChange={e => setForm({ ...form, billingAddress2: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City</Label><Input value={form.billingCity} onChange={e => setForm({ ...form, billingCity: e.target.value })} /></div>
              <div><Label>Emirate / State</Label>
                <Select value={form.billingState} onValueChange={v => setForm({ ...form, billingState: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {UAE_EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Postal Code</Label><Input value={form.billingPostalCode} onChange={e => setForm({ ...form, billingPostalCode: e.target.value })} /></div>
              <div><Label>Country</Label><Input value={form.billingCountry} onChange={e => setForm({ ...form, billingCountry: e.target.value })} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={copyBillingToShipping}>Copy to Shipping →</Button>
          </TabsContent>

          <TabsContent value="shipping" className="space-y-3 mt-4">
            <div><Label>Address Line 1</Label><Input value={form.shippingAddress1} onChange={e => setForm({ ...form, shippingAddress1: e.target.value })} /></div>
            <div><Label>Address Line 2</Label><Input value={form.shippingAddress2} onChange={e => setForm({ ...form, shippingAddress2: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City</Label><Input value={form.shippingCity} onChange={e => setForm({ ...form, shippingCity: e.target.value })} /></div>
              <div><Label>Emirate / State</Label>
                <Select value={form.shippingState} onValueChange={v => setForm({ ...form, shippingState: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {UAE_EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Postal Code</Label><Input value={form.shippingPostalCode} onChange={e => setForm({ ...form, shippingPostalCode: e.target.value })} /></div>
              <div><Label>Country</Label><Input value={form.shippingCountry} onChange={e => setForm({ ...form, shippingCountry: e.target.value })} /></div>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Payment Terms (days)</Label><Input type="number" value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: parseInt(e.target.value) || 30 })} /></div>
              <div><Label>Credit Limit</Label><Input type="number" step="0.01" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Opening Balance</Label><Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Balance Type</Label>
                <Select value={form.openingBalanceType} onValueChange={v => setForm({ ...form, openingBalanceType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">Debit (they owe us)</SelectItem>
                    <SelectItem value="CREDIT">Credit (we owe them)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.name}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
