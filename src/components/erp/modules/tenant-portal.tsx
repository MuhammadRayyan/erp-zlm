'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserCog, Users, Building2, CreditCard, Plus, Trash2, Shield, Check, AlertCircle } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface TenantUser {
  id: string; userId: string; email: string; name: string
  role: string; isActive: boolean; lastLoginAt: string | null; joinedAt: string
}
interface TenantBusiness {
  id: string; name: string; legalName: string | null; trn: string | null
  baseCurrency: string; vatRegistered: boolean; vatRate: number
  invoiceCount: number; customerCount: number; itemCount: number; isCurrent: boolean
}
interface Subscription {
  tenant: { id: string; name: string; slug: string; status: string; trialEndsAt: string | null }
  subscription: { id: string; status: string; billingCycle: string; currentPeriodEnd: string | null; trialEndsAt: string | null } | null
  plan: { id: string; name: string; description: string | null; maxBusinesses: number; maxUsers: number; maxInvoicesPerMonth: number; priceMonthly: number; priceYearly: number; features: Record<string, boolean> } | null
  usage: { businesses: number; users: number }
}
interface Plan {
  id: string; name: string; description: string | null
  maxBusinesses: number; maxUsers: number; maxInvoicesPerMonth: number
  priceMonthly: number; priceYearly: number; features: Record<string, boolean>; isPublic: boolean
}

export function TenantPortal({ auth }: ModuleProps) {
  const canManage = auth.currentTenantRole === 'TENANT_ADMIN' || auth.user.role === 'PLATFORM_ADMIN'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <UserCog className="h-6 w-6 text-emerald-600" /> Organization Settings
        </h2>
        <p className="text-sm text-muted-foreground">Manage users, businesses, and subscription for your organization</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3">
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="businesses"><Building2 className="mr-2 h-4 w-4" /> Businesses</TabsTrigger>
          <TabsTrigger value="subscription"><CreditCard className="mr-2 h-4 w-4" /> Subscription</TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab canManage={canManage} /></TabsContent>
        <TabsContent value="businesses"><BusinessesTab canManage={canManage} /></TabsContent>
        <TabsContent value="subscription"><SubscriptionTab canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  )
}

function UsersTab({ canManage }: { canManage: boolean }) {
  const { data: users, loading, refetch } = useFetch<TenantUser[]>('/api/tenant/users')

  if (loading) return <LoadingSpinner message="Loading users..." />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Organization Users</CardTitle>
        {canManage && <InviteUserDialog onSaved={refetch} />}
      </CardHeader>
      <CardContent className="p-0">
        {!users || users.length === 0 ? <EmptyState title="No users" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
              <TableHead>Status</TableHead><TableHead>Last Login</TableHead><TableHead>Joined</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell><RoleBadge role={u.role} /></TableCell>
                  <TableCell>{u.isActive ? <Badge className="bg-emerald-100 text-emerald-700">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="text-xs">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never'}</TableCell>
                  <TableCell className="text-xs">{fmtDate(u.joinedAt)}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Select defaultValue={u.role} onValueChange={async (v) => {
                          const res = await fetch(`/api/tenant/users?id=${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: v, isActive: u.isActive }) })
                          if (res.ok) { toast.success('Role updated'); refetch() }
                        }}>
                          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TENANT_ADMIN">Admin</SelectItem>
                            <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                            <SelectItem value="VIEWER">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={async () => {
                          if (!confirm('Remove this user from the organization?')) return
                          const res = await fetch(`/api/tenant/users?id=${u.id}`, { method: 'DELETE' })
                          if (res.ok) { toast.success('User removed'); refetch() }
                          else { const e = await res.json(); toast.error(e.error || 'Failed') }
                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    TENANT_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    ACCOUNTANT: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    VIEWER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  }
  const labels: Record<string, string> = { TENANT_ADMIN: 'Admin', ACCOUNTANT: 'Accountant', VIEWER: 'Viewer' }
  return <Badge variant="outline" className={colors[role] || colors.VIEWER}>{labels[role] || role}</Badge>
}

function InviteUserDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', email: '', role: 'ACCOUNTANT', password: '' })
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/tenant/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('User added'); setOpen(false); onSaved(); setForm({ name: '', email: '', role: 'ACCOUNTANT', password: '' }) }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
    setSaving(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add User to Organization</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Set initial password" /></div>
            <div><Label>Role</Label><Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="TENANT_ADMIN">Admin — full access including settings & user management</SelectItem>
              <SelectItem value="ACCOUNTANT">Accountant — create invoices, bills, payments, journal</SelectItem>
              <SelectItem value="VIEWER">Viewer — read-only access</SelectItem>
            </SelectContent></Select></div>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Users can only see data within this organization.</p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving || !form.name || !form.email}>{saving ? 'Adding...' : 'Add User'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BusinessesTab({ canManage }: { canManage: boolean }) {
  const { data: businesses, loading, refetch } = useFetch<TenantBusiness[]>('/api/tenant/businesses')

  if (loading) return <LoadingSpinner message="Loading businesses..." />

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Businesses</CardTitle>
        {canManage && <CreateBusinessDialog onSaved={refetch} />}
      </CardHeader>
      <CardContent className="p-0">
        {!businesses || businesses.length === 0 ? <EmptyState title="No businesses" /> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>TRN</TableHead><TableHead>Currency</TableHead>
              <TableHead>VAT</TableHead><TableHead className="text-center">Invoices</TableHead>
              <TableHead className="text-center">Customers</TableHead><TableHead className="text-center">Items</TableHead>
              <TableHead>Current</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {businesses.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="font-mono text-xs">{b.trn || '—'}</TableCell>
                  <TableCell>{b.baseCurrency}</TableCell>
                  <TableCell>{b.vatRegistered ? <Badge className="bg-emerald-100 text-emerald-700">{b.vatRate}%</Badge> : <Badge variant="secondary">Not registered</Badge>}</TableCell>
                  <TableCell className="text-center">{b.invoiceCount}</TableCell>
                  <TableCell className="text-center">{b.customerCount}</TableCell>
                  <TableCell className="text-center">{b.itemCount}</TableCell>
                  <TableCell>{b.isCurrent ? <Badge className="bg-blue-100 text-blue-700"><Check className="mr-1 h-3 w-3" /> Current</Badge> : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function CreateBusinessDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', legalName: '', trn: '', email: '', phone: '', addressLine1: '', city: '', state: '', baseCurrency: 'AED', vatRegistered: true, vatRate: 5 })
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/tenant/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Business created'); setOpen(false); onSaved(); window.location.reload() }
    else { const e = await res.json(); toast.error(e.error || 'Failed') }
    setSaving(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Business</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create New Business</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Business Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Legal Name</Label><Input value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>TRN</Label><Input value={form.trn} onChange={e => setForm({ ...form, trn: e.target.value })} maxLength={15} /></div>
              <div><Label>Currency</Label><Input value={form.baseCurrency} onChange={e => setForm({ ...form, baseCurrency: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.addressLine1} onChange={e => setForm({ ...form, addressLine1: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Emirate / State</Label><Select value={form.state} onValueChange={v => setForm({ ...form, state: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="Abu Dhabi">Abu Dhabi</SelectItem><SelectItem value="Dubai">Dubai</SelectItem><SelectItem value="Sharjah">Sharjah</SelectItem><SelectItem value="Ajman">Ajman</SelectItem><SelectItem value="Umm Al Quwain">Umm Al Quwain</SelectItem><SelectItem value="Ras Al Khaimah">Ras Al Khaimah</SelectItem><SelectItem value="Fujairah">Fujairah</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.vatRegistered} onChange={e => setForm({ ...form, vatRegistered: e.target.checked, vatRate: e.target.checked ? 5 : 0 })} /> VAT Registered</label>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving || !form.name}>{saving ? 'Creating...' : 'Create Business'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SubscriptionTab({ canManage }: { canManage: boolean }) {
  const { data: sub, loading } = useFetch<Subscription>('/api/tenant/subscription')
  const { data: plans } = useFetch<Plan[]>('/api/admin/plans')

  if (loading) return <LoadingSpinner message="Loading subscription..." />
  if (!sub) return <EmptyState title="No subscription" />

  const usagePctBusinesses = sub.plan ? (sub.usage.businesses / sub.plan.maxBusinesses) * 100 : 0
  const usagePctUsers = sub.plan ? (sub.usage.users / sub.plan.maxUsers) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Current Plan */}
      <Card>
        <CardHeader><CardTitle>Current Plan</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{sub.plan?.name || 'No Plan'}</h3>
              <p className="text-sm text-muted-foreground">{sub.plan?.description || 'Contact admin to assign a plan'}</p>
              <div className="mt-2">
                <Badge className={
                  sub.tenant.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                  sub.tenant.status === 'TRIAL' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }>{sub.tenant.status}</Badge>
                {sub.subscription?.trialEndsAt && (
                  <span className="ml-2 text-xs text-muted-foreground">Trial ends {fmtDate(sub.subscription.trialEndsAt)}</span>
                )}
              </div>
            </div>
            {sub.plan && <div className="text-right"><span className="text-2xl font-bold">{fmtMoney(sub.plan.priceMonthly, 'AED')}</span><span className="text-sm text-muted-foreground">/mo</span></div>}
          </div>

          {/* Usage */}
          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Businesses</span><span className="font-medium">{sub.usage.businesses} / {sub.plan?.maxBusinesses || '∞'}</span></div>
              <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(usagePctBusinesses, 100)}%` }} /></div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Users</span><span className="font-medium">{sub.usage.users} / {sub.plan?.maxUsers || '∞'}</span></div>
              <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(usagePctUsers, 100)}%` }} /></div>
            </div>
          </div>

          {/* Features */}
          {sub.plan && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">Included Features:</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(sub.plan.features).filter(([, v]) => v).map(([k]) => (
                  <Badge key={k} variant="secondary" className="text-xs"><Check className="mr-1 h-3 w-3" /> {k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Plans */}
      {canManage && plans && (
        <Card>
          <CardHeader><CardTitle>Available Plans</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {plans.filter(p => p.isPublic).map(p => (
                <Card key={p.id} className={p.name === sub.plan?.name ? 'border-emerald-500' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold">{p.name}</h3>
                      {p.name === sub.plan?.name && <Badge className="bg-emerald-100 text-emerald-700">Current</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    <div className="mt-3"><span className="text-xl font-bold">{fmtMoney(p.priceMonthly, 'AED')}</span><span className="text-xs text-muted-foreground">/mo</span></div>
                    <div className="mt-2 space-y-0.5 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Businesses</span><span>{p.maxBusinesses === 0 ? '∞' : p.maxBusinesses}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Users</span><span>{p.maxUsers === 0 ? '∞' : p.maxUsers}</span></div>
                    </div>
                    {p.name !== sub.plan?.name && (
                      <Button size="sm" className="mt-3 w-full" onClick={async () => {
                        const res = await fetch('/api/tenant/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: p.id }) })
                        if (res.ok) { toast.success(`Switched to ${p.name}`); window.location.reload() }
                        else { const e = await res.json(); toast.error(e.error || 'Failed') }
                      }}>
                        {p.priceMonthly > (sub.plan?.priceMonthly || 0) ? 'Upgrade' : 'Downgrade'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
