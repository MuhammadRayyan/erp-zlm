'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Save, Building2, Percent, Coins, Hash } from 'lucide-react'
import { UAE_EMIRATES } from '@/lib/constants'
import { useFetch, LoadingSpinner } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface TaxRate { id: string; name: string; nameAr: string | null; rate: number; category: string; isDefault: boolean; isActive: boolean }
interface Currency { id: string; code: string; name: string; symbol: string; isBase: boolean; exchangeRate: number }

export function SettingsModule({ business }: ModuleProps) {
  const { data: taxRates, refetch: refetchTax } = useFetch<TaxRate[]>('/api/tax-rates')
  const { data: currencies } = useFetch<Currency[]>('/api/currencies')
  const [bizForm, setBizForm] = React.useState<Record<string, unknown> | null>(null)
  const [savingBiz, setSavingBiz] = React.useState(false)

  React.useEffect(() => {
    if (business && !bizForm) {
      setBizForm({
        name: business.name, legalName: business.legalName || '', trn: business.trn || '', email: business.email || '',
        phone: business.phone || '', website: business.website || '', addressLine1: business.addressLine1 || '',
        addressLine2: business.addressLine2 || '', city: business.city || '', state: business.state || '',
        postalCode: business.postalCode || '', country: business.country || 'AE', baseCurrency: business.baseCurrency,
        vatRegistered: business.vatRegistered, vatRate: business.vatRate,
        invoicePrefix: business.invoicePrefix, billPrefix: business.billPrefix, quotationPrefix: business.quotationPrefix,
        creditNotePrefix: business.creditNotePrefix, receiptPrefix: business.receiptPrefix, paymentPrefix: business.paymentPrefix,
        deliveryNotePrefix: business.deliveryNotePrefix,
      })
    }
  }, [business, bizForm])

  if (!business || !bizForm) return <LoadingSpinner message="Loading settings..." />

  const saveBusiness = async () => {
    setSavingBiz(true)
    const res = await fetch('/api/business', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bizForm) })
    if (res.ok) toast.success('Settings saved')
    else toast.error('Failed to save')
    setSavingBiz(false)
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold tracking-tight">Settings</h2><p className="text-sm text-muted-foreground">Configure your business, tax rates, currencies, and numbering</p></div>

      <Tabs defaultValue="business">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="business"><Building2 className="mr-2 h-4 w-4" />Business</TabsTrigger>
          <TabsTrigger value="tax"><Percent className="mr-2 h-4 w-4" />Tax Rates</TabsTrigger>
          <TabsTrigger value="currencies"><Coins className="mr-2 h-4 w-4" />Currencies</TabsTrigger>
          <TabsTrigger value="numbering"><Hash className="mr-2 h-4 w-4" />Numbering</TabsTrigger>
        </TabsList>

        {/* Business settings */}
        <TabsContent value="business" className="space-y-4">
          <Card><CardHeader><CardTitle>Business Information</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Business Name *</Label><Input value={bizForm.name as string} onChange={e => setBizForm({ ...bizForm, name: e.target.value })} /></div>
              <div><Label>Legal Name</Label><Input value={bizForm.legalName as string} onChange={e => setBizForm({ ...bizForm, legalName: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>TRN (Tax Registration Number)</Label><Input value={bizForm.trn as string} onChange={e => setBizForm({ ...bizForm, trn: e.target.value })} maxLength={15} placeholder="100000000000003" /></div>
              <div><Label>VAT Registered</Label><div className="flex h-10 items-center gap-2"><Checkbox id="vat" checked={bizForm.vatRegistered as boolean} onCheckedChange={v => setBizForm({ ...bizForm, vatRegistered: v === true })} /><Label htmlFor="vat">This business is VAT registered</Label></div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input value={bizForm.email as string} onChange={e => setBizForm({ ...bizForm, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={bizForm.phone as string} onChange={e => setBizForm({ ...bizForm, phone: e.target.value })} /></div>
            </div>
            <div><Label>Website</Label><Input value={bizForm.website as string} onChange={e => setBizForm({ ...bizForm, website: e.target.value })} /></div>
          </CardContent></Card>

          <Card><CardHeader><CardTitle>Address</CardTitle></CardHeader><CardContent className="space-y-4">
            <div><Label>Address Line 1</Label><Input value={bizForm.addressLine1 as string} onChange={e => setBizForm({ ...bizForm, addressLine1: e.target.value })} /></div>
            <div><Label>Address Line 2</Label><Input value={bizForm.addressLine2 as string} onChange={e => setBizForm({ ...bizForm, addressLine2: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>City</Label><Input value={bizForm.city as string} onChange={e => setBizForm({ ...bizForm, city: e.target.value })} /></div>
              <div><Label>Emirate / State</Label><Select value={bizForm.state as string} onValueChange={v => setBizForm({ ...bizForm, state: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{UAE_EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Postal Code</Label><Input value={bizForm.postalCode as string} onChange={e => setBizForm({ ...bizForm, postalCode: e.target.value })} /></div>
              <div><Label>Country</Label><Input value={bizForm.country as string} onChange={e => setBizForm({ ...bizForm, country: e.target.value })} /></div>
            </div>
          </CardContent></Card>

          <div className="flex justify-end"><Button onClick={saveBusiness} disabled={savingBiz}><Save className="mr-2 h-4 w-4" />{savingBiz ? 'Saving...' : 'Save Settings'}</Button></div>
        </TabsContent>

        {/* Tax rates */}
        <TabsContent value="tax">
          <Card><CardHeader><CardTitle>VAT / Tax Rates</CardTitle></CardHeader><CardContent>
            <div className="space-y-2">
              {taxRates?.map(t => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div><div className="flex items-center gap-2"><span className="font-medium">{t.name}</span>{t.isDefault && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Default</Badge>}</div>{t.nameAr && <span className="text-xs text-muted-foreground" dir="rtl">{t.nameAr}</span>}</div>
                  <div className="flex items-center gap-3"><Badge variant="outline">{t.category.replace(/_/g, ' ')}</Badge><span className="text-lg font-bold">{t.rate}%</span></div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* Currencies */}
        <TabsContent value="currencies">
          <Card><CardHeader><CardTitle>Currencies</CardTitle></CardHeader><CardContent>
            <div className="space-y-2">
              {currencies?.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3"><span className="text-lg font-bold">{c.symbol}</span><div><div className="font-medium">{c.code} - {c.name}</div>{c.isBase && <Badge className="bg-emerald-100 text-emerald-700 text-xs">Base Currency</Badge>}</div></div>
                  <div className="text-sm text-muted-foreground">Rate: {c.exchangeRate}</div>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* Numbering */}
        <TabsContent value="numbering">
          <Card><CardHeader><CardTitle>Document Numbering</CardTitle></CardHeader><CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Customize the prefixes for each document type.</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Invoice Prefix</Label><Input value={bizForm.invoicePrefix as string} onChange={e => setBizForm({ ...bizForm, invoicePrefix: e.target.value })} /></div>
              <div><Label>Bill Prefix</Label><Input value={bizForm.billPrefix as string} onChange={e => setBizForm({ ...bizForm, billPrefix: e.target.value })} /></div>
              <div><Label>Quotation Prefix</Label><Input value={bizForm.quotationPrefix as string} onChange={e => setBizForm({ ...bizForm, quotationPrefix: e.target.value })} /></div>
              <div><Label>Credit Note Prefix</Label><Input value={bizForm.creditNotePrefix as string} onChange={e => setBizForm({ ...bizForm, creditNotePrefix: e.target.value })} /></div>
              <div><Label>Receipt Prefix</Label><Input value={bizForm.receiptPrefix as string} onChange={e => setBizForm({ ...bizForm, receiptPrefix: e.target.value })} /></div>
              <div><Label>Payment Prefix</Label><Input value={bizForm.paymentPrefix as string} onChange={e => setBizForm({ ...bizForm, paymentPrefix: e.target.value })} /></div>
              <div><Label>Delivery Note Prefix</Label><Input value={bizForm.deliveryNotePrefix as string} onChange={e => setBizForm({ ...bizForm, deliveryNotePrefix: e.target.value })} /></div>
            </div>
            <div className="flex justify-end"><Button onClick={saveBusiness} disabled={savingBiz}><Save className="mr-2 h-4 w-4" />{savingBiz ? 'Saving...' : 'Save'}</Button></div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
