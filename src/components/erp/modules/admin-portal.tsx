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
import { Textarea } from '@/components/ui/textarea'
import { Shield, Users, Building2, DollarSign, Plus, Key, Pencil, Ban, RefreshCw } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Tenant {
  id: string; name: string; slug: string; email: string; phone: string | null
  status: string; trialEndsAt: string | null; createdAt: string
  plan: string; subscriptionStatus: string; businessCount: number; userCount: number
}
interface Plan {
  id: string; name: string; description: string | null
  maxBusinesses: number; maxUsers: number; maxInvoicesPerMonth: number
  priceMonthly: number; priceYearly: number; features: Record<string, boolean>; isPublic: boolean
}
interface License {
  id: string; key: string; tenantId: string | null; tenantName: string | null
  planName: string; type: string; maxBusinesses: number; maxUsers: number
  issuedTo: string | null; issuedAt: string; expiresAt: string | null; status: string; notes: string | null
}
interface Stats {
  tenants: { total: number; active: number; trial: number }
  users: number; businesses: number
  invoices: { total: number; thisMonth: number; thisMonthValue: number }
  licenses: { active: number }
  plans: { plan: string; subscribers: number; monthlyValue: number }[]
  monthlyRecurringRevenue: number
}

export function AdminPortal({ auth }: ModuleProps) {
  if (auth.user.role !== 'PLATFORM_ADMIN') {
    return <EmptyState title="Access Denied" description="Platform admin access required." />
  }
  return <AdminPortalContent />
}

function AdminPortalContent() {
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useFetch<Stats>('/api/admin/stats')
  const { data: tenants, loading: tenantsLoading, refetch: refetchTenants } = useFetch<Tenant[]>('/api/admin/tenants')
  const { data: plans, refetch: refetchPlans } = useFetch<Plan[]>('/api/admin/plans')
  const { data: licenses, refetch: refetchLicenses } = useFetch<License[]>('/api/admin/licenses')

  const refetchAll = () => { refetchStats(); refetchTenants(); refetchPlans(); refetchLicenses() }

  if (statsLoading) return <LoadingSpinner message="Loading admin portal..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-600" /> Platform Admin Portal
          </h2>
          <p className="text-sm text-muted-foreground">Manage tenants, licenses, plans, and platform-wide settings</p>
        </div>
        <Button variant="outline" onClick={refetchAll}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">Total Tenants</p><p className="mt-1 text-2xl font-bold">{stats?.tenants.total || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stats?.tenants.active || 0} active, {stats?.tenants.trial || 0} trial</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500 text-white"><Building2 className="h-5 w-5" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">Total Users</p><p className="mt-1 text-2xl font-bold">{stats?.users || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Across all tenants</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500 text-white"><Users className="h-5 w-5" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">MRR</p><p className="mt-1 text-2xl font-bold">{fmtMoney(stats?.monthlyRecurringRevenue || 0, 'AED')}</p>
            <p className="mt-1 text-xs text-muted-foreground">Monthly recurring revenue</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-500 text-white"><DollarSign className="h-5 w-5" /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-muted-foreground">Active Licenses</p><p className="mt-1 text-2xl font-bold">{stats?.licenses.active || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stats?.invoices.thisMonth || 0} invoices this month</p></div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500 text-white"><Key className="h-5 w-5" /></div>
          </div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="tenants">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="licenses">Licenses</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        {/* Tenants Tab */}
        <TabsContent value="tenants">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Tenants</CardTitle>
              <CreateTenantDialog plans={plans || []} onCreated={refetchTenants} />
            </CardHeader>
            <CardContent className="p-0">
              {tenantsLoading ? <LoadingSpinner /> : !tenants || tenants.length === 0 ? <EmptyState title="No tenants" /> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-center">Businesses</TableHead>
                    <TableHead className="text-center">Users</TableHead><TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {tenants.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}<div className="text-xs text-muted-foreground">{t.slug}</div></TableCell>
                        <TableCell className="text-sm">{t.email}</TableCell>
                        <TableCell><Badge variant="outline">{t.plan}</Badge></TableCell>
                        <TableCell><StatusBadge status={t.status} /></TableCell>
                        <TableCell className="text-center">{t.businessCount}</TableCell>
                        <TableCell className="text-center">{t.userCount}</TableCell>
                        <TableCell className="text-xs">{fmtDate(t.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <EditTenantDialog tenant={t} plans={plans || []} onSaved={refetchTenants} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Licenses Tab */}
        <TabsContent value="licenses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Licenses</CardTitle>
              <CreateLicenseDialog tenants={tenants || []} onCreated={refetchLicenses} />
            </CardHeader>
            <CardContent className="p-0">
              {!licenses || licenses.length === 0 ? <EmptyState title="No licenses" description="Generate license keys for customers." /> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>License Key</TableHead><TableHead>Plan</TableHead><TableHead>Type</TableHead>
                    <TableHead>Tenant</TableHead><TableHead>Issued To</TableHead>
                    <TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {licenses.map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs font-bold">{l.key}</TableCell>
                        <TableCell><Badge variant="outline">{l.planName}</Badge></TableCell>
                        <TableCell className="text-xs">{l.type}</TableCell>
                        <TableCell className="text-sm">{l.tenantName || '—'}</TableCell>
                        <TableCell className="text-xs">{l.issuedTo || '—'}</TableCell>
                        <TableCell className="text-xs">{l.expiresAt ? fmtDate(l.expiresAt) : 'Never'}</TableCell>
                        <TableCell><StatusBadge status={l.status} /></TableCell>
                        <TableCell className="text-right">
                          {l.status === 'ACTIVE' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={async () => {
                              if (!confirm('Revoke this license?')) return
                              const res = await fetch(`/api/admin/licenses?id=${l.id}`, { method: 'DELETE' })
                              if (res.ok) { toast.success('License revoked'); refetchLicenses() }
                            }}><Ban className="h-3.5 w-3.5" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans">
          <Card>
            <CardHeader><CardTitle>Subscription Plans</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {plans?.map(p => (
                  <Card key={p.id} className={p.name === 'Professional' ? 'border-emerald-500' : ''}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold">{p.name}</h3>
                        {p.name === 'Professional' && <Badge className="bg-emerald-100 text-emerald-700">Popular</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                      <div className="mt-3"><span className="text-2xl font-bold">{fmtMoney(p.priceMonthly, 'AED')}</span><span className="text-sm text-muted-foreground">/mo</span></div>
                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Businesses</span><span className="font-medium">{p.maxBusinesses === 0 ? '∞' : p.maxBusinesses}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Users</span><span className="font-medium">{p.maxUsers === 0 ? '∞' : p.maxUsers}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Invoices/mo</span><span className="font-medium">{p.maxInvoicesPerMonth === 0 ? '∞' : p.maxInvoicesPerMonth}</span></div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Object.entries(p.features).filter(([, v]) => v).map(([k]) => (
                          <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <Card>
            <CardHeader><CardTitle>Revenue by Plan</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead className="text-center">Subscribers</TableHead><TableHead className="text-right">Monthly Price</TableHead><TableHead className="text-right">Monthly Revenue</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stats?.plans.map(p => (
                    <TableRow key={p.plan}>
                      <TableCell className="font-medium">{p.plan}</TableCell>
                      <TableCell className="text-center">{p.subscribers}</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(p.monthlyValue, 'AED')}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell colSpan={3}>Total MRR</TableCell>
                    <TableCell className="text-right text-emerald-600">{fmtMoney(stats?.monthlyRecurringRevenue || 0, 'AED')}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    TRIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    PAST_DUE: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    EXPIRED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    REVOKED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  }
  return <Badge variant="outline" className={colors[status] || colors.ACTIVE}>{status}</Badge>
}

function CreateTenantDialog({ plans, onCreated }: { plans: Plan[]; onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', email: '', planId: '', status: 'ACTIVE' })
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Tenant created'); setOpen(false); onCreated(); setForm({ name: '', email: '', planId: '', status: 'ACTIVE' }) }
    else toast.error('Failed')
    setSaving(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Tenant</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Tenant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Plan</Label><Select value={form.planId} onValueChange={v => setForm({ ...form, planId: v })}><SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger><SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="TRIAL">Trial</SelectItem><SelectItem value="SUSPENDED">Suspended</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving || !form.name}>{saving ? 'Creating...' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EditTenantDialog({ tenant, plans, onSaved }: { tenant: Tenant; plans: Plan[]; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ name: tenant.name, email: tenant.email, phone: tenant.phone || '', status: tenant.status, planId: '', subscriptionStatus: tenant.subscriptionStatus })

  React.useEffect(() => {
    if (open) {
      const plan = plans.find(p => p.name === tenant.plan)
      setForm({ name: tenant.name, email: tenant.email, phone: tenant.phone || '', status: tenant.status, planId: plan?.id || '', subscriptionStatus: tenant.subscriptionStatus })
    }
  }, [open, tenant, plans])

  const save = async () => {
    const res = await fetch(`/api/admin/tenants?id=${tenant.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('Tenant updated'); setOpen(false); onSaved() }
    else toast.error('Failed')
  }

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}><Pencil className="h-3.5 w-3.5" /></Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Tenant: {tenant.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="TRIAL">Trial</SelectItem><SelectItem value="SUSPENDED">Suspended</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></div>
            <div><Label>Plan</Label><Select value={form.planId || 'NONE'} onValueChange={v => setForm({ ...form, planId: v === 'NONE' ? '' : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">No plan</SelectItem>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Subscription Status</Label><Select value={form.subscriptionStatus || 'NONE'} onValueChange={v => setForm({ ...form, subscriptionStatus: v === 'NONE' ? '' : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">None</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="TRIAL">Trial</SelectItem><SelectItem value="PAST_DUE">Past Due</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CreateLicenseDialog({ tenants, onCreated }: { tenants: Tenant[]; onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ tenantId: '', planName: 'Professional', type: 'ANNUAL', maxBusinesses: 3, maxUsers: 10, issuedTo: '', expiresAt: '', notes: '' })
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/licenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { toast.success('License created'); setOpen(false); onCreated() }
    else toast.error('Failed')
    setSaving(false)
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Key className="mr-2 h-4 w-4" /> Generate License</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate License Key</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tenant (optional)</Label><Select value={form.tenantId || 'NONE'} onValueChange={v => setForm({ ...form, tenantId: v === 'NONE' ? '' : v })}><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value="NONE">Unassigned</SelectItem>{tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Plan</Label><Select value={form.planName} onValueChange={v => setForm({ ...form, planName: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Free">Free</SelectItem><SelectItem value="Starter">Starter</SelectItem><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Enterprise">Enterprise</SelectItem></SelectContent></Select></div>
            <div><Label>Type</Label><Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LIFETIME">Lifetime</SelectItem><SelectItem value="ANNUAL">Annual</SelectItem><SelectItem value="MONTHLY">Monthly</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Max Businesses</Label><Input type="number" value={form.maxBusinesses} onChange={e => setForm({ ...form, maxBusinesses: parseInt(e.target.value) || 1 })} /></div>
              <div><Label>Max Users</Label><Input type="number" value={form.maxUsers} onChange={e => setForm({ ...form, maxUsers: parseInt(e.target.value) || 1 })} /></div>
            </div>
            <div><Label>Issued To (email)</Label><Input value={form.issuedTo} onChange={e => setForm({ ...form, issuedTo: e.target.value })} /></div>
            <div><Label>Expires At (optional)</Label><Input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Generating...' : 'Generate License'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
