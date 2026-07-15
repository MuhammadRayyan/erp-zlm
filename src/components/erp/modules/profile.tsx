'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { User, Mail, Lock, Shield, Activity, Building2, Calendar, Check, Loader2, KeyRound } from 'lucide-react'
import { fmtDate, LoadingSpinner, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  tenants: { id: string; name: string; slug: string; role: string; status: string; plan: string; joinedAt: string }[]
  stats: { invoicesCreated: number; billsCreated: number; paymentsRecorded: number; journalEntries: number }
}

export function ProfileModule({ auth, refreshAuth }: ModuleProps) {
  const { data: profile, loading, refetch } = useFetch<UserProfile>('/api/auth/profile')

  if (loading) return <LoadingSpinner message="Loading profile..." />

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Profile</h2>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">Unable to load profile. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <User className="h-6 w-6 text-emerald-600" /> My Profile
        </h2>
        <p className="text-sm text-muted-foreground">Manage your account, security, and view your activity</p>
      </div>

      {/* Profile header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-2xl font-bold text-white">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-xl font-bold">{profile.name}</h3>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge className={profile.role === 'PLATFORM_ADMIN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}>
                    {profile.role === 'PLATFORM_ADMIN' ? 'Platform Admin' : 'User'}
                  </Badge>
                  {profile.isActive ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {profile.lastLoginAt && (
                <p>Last login: {fmtDate(profile.lastLoginAt)}</p>
              )}
              <p>Member since: {fmtDate(profile.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="account">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="account"><User className="mr-2 h-4 w-4" /> Account</TabsTrigger>
          <TabsTrigger value="security"><Lock className="mr-2 h-4 w-4" /> Security</TabsTrigger>
          <TabsTrigger value="permissions"><Shield className="mr-2 h-4 w-4" /> Permissions</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="mr-2 h-4 w-4" /> Activity</TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account">
          <AccountTab profile={profile} onSaved={refetch} onAuthRefresh={refreshAuth} />
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <PermissionsTab profile={profile} auth={auth} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <ActivityTab profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================
// ACCOUNT TAB
// ============================================================
function AccountTab({ profile, onSaved, onAuthRefresh }: { profile: UserProfile; onSaved: () => void; onAuthRefresh: () => void }) {
  const [name, setName] = React.useState(profile.name)
  const [email, setEmail] = React.useState(profile.email)
  const [saving, setSaving] = React.useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Profile updated')
        onSaved()
        onAuthRefresh()
      } else {
        toast.error(data.error || 'Failed to update')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Account Information</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" value={name} onChange={e => setName(e.target.value)} className="pl-9" />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Changing your email will affect login.</p>
        </div>
        <div>
          <Label>Account Type</Label>
          <div className="mt-1">
            <Badge className={profile.role === 'PLATFORM_ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
              {profile.role === 'PLATFORM_ADMIN' ? 'Platform Administrator' : 'Standard User'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Account type is managed by administrators and cannot be changed by users.</p>
        </div>
        <Button onClick={save} disabled={saving || (!name && !email) || (name === profile.name && email === profile.email)}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================
// SECURITY TAB
// ============================================================
function SecurityTab() {
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(data.error || 'Failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-pw">Current Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="current-pw" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
            </div>
          </div>
          <div>
            <Label htmlFor="new-pw">New Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="new-pw" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="pl-9" placeholder="Min 6 characters" />
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirm New Password</Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="confirm-pw" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
            </div>
          </div>
          <Button onClick={changePassword} disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Changing...</> : 'Change Password'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Security Information</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Password Hashing</span>
            <Badge className="bg-emerald-100 text-emerald-700">bcrypt (10 rounds)</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Session Type</span>
            <Badge className="bg-emerald-100 text-emerald-700">JWT (7 days)</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cookie Security</span>
            <Badge className="bg-emerald-100 text-emerald-700">HTTP-only, SameSite</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Two-Factor Auth</span>
            <Badge variant="secondary">Not configured</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// PERMISSIONS TAB
// ============================================================
function PermissionsTab({ profile, auth }: { profile: UserProfile; auth: import('../app-shell').AuthState }) {
  const isPlatformAdmin = profile.role === 'PLATFORM_ADMIN'
  const currentRole = auth.currentTenantRole || (isPlatformAdmin ? 'TENANT_ADMIN' : 'VIEWER')

  const allPermissions = [
    { key: 'View Dashboard', desc: 'Access the main dashboard and KPIs', roles: ['TENANT_ADMIN', 'ACCOUNTANT', 'VIEWER'] },
    { key: 'Create/Edit Invoices', desc: 'Create and modify sales invoices', roles: ['TENANT_ADMIN', 'ACCOUNTANT'] },
    { key: 'Create/Edit Bills', desc: 'Create and modify purchase bills', roles: ['TENANT_ADMIN', 'ACCOUNTANT'] },
    { key: 'Record Payments', desc: 'Record receipts and payments', roles: ['TENANT_ADMIN', 'ACCOUNTANT'] },
    { key: 'Journal Entries', desc: 'Create manual journal entries', roles: ['TENANT_ADMIN', 'ACCOUNTANT'] },
    { key: 'View Reports', desc: 'Access financial reports', roles: ['TENANT_ADMIN', 'ACCOUNTANT', 'VIEWER'] },
    { key: 'Manage Business Settings', desc: 'Edit business profile, tax rates, currencies', roles: ['TENANT_ADMIN'] },
    { key: 'Manage Users', desc: 'Invite, edit, and remove tenant users', roles: ['TENANT_ADMIN'] },
    { key: 'Manage Businesses', desc: 'Create and delete businesses', roles: ['TENANT_ADMIN'] },
    { key: 'Manage Subscription', desc: 'Upgrade or downgrade subscription plan', roles: ['TENANT_ADMIN'] },
    { key: 'Manage Custom Fields', desc: 'Create and edit custom field definitions', roles: ['TENANT_ADMIN'] },
    { key: 'Manage PDF Templates', desc: 'Create and edit PDF templates', roles: ['TENANT_ADMIN'] },
    { key: 'Delete Records', desc: 'Delete invoices, bills, parties, items', roles: ['TENANT_ADMIN', 'ACCOUNTANT'] },
    { key: 'Period Locking', desc: 'Lock and unlock accounting periods', roles: ['TENANT_ADMIN'] },
    { key: 'Backup & Export', desc: 'Export data and create backups', roles: ['TENANT_ADMIN', 'ACCOUNTANT'] },
    { key: 'Import Data', desc: 'Import data from JSON or CSV', roles: ['TENANT_ADMIN'] },
    { key: 'Platform Admin', desc: 'Full system access — manage all tenants', roles: ['PLATFORM_ADMIN'] },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Permissions & Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Current Role</p>
              <p className="text-xs text-muted-foreground">Your role determines what you can do in the system</p>
            </div>
            <Badge className={
              currentRole === 'TENANT_ADMIN' ? 'bg-purple-100 text-purple-700' :
              currentRole === 'ACCOUNTANT' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }>{currentRole.replace('_', ' ')}</Badge>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold">Permission Matrix</p>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-2 text-left font-medium">Permission</th>
                  <th className="p-2 text-left font-medium">Description</th>
                  <th className="p-2 text-center font-medium">Your Access</th>
                </tr>
              </thead>
              <tbody>
                {allPermissions.map(perm => {
                  const hasAccess = isPlatformAdmin || perm.roles.includes(currentRole)
                  return (
                    <tr key={perm.key} className="border-b last:border-0">
                      <td className="p-2 font-medium">{perm.key}</td>
                      <td className="p-2 text-xs text-muted-foreground">{perm.desc}</td>
                      <td className="p-2 text-center">
                        {hasAccess ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tenant memberships */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Organization Memberships</p>
          {profile.tenants.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.slug} • {t.plan}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={
                  t.role === 'TENANT_ADMIN' ? 'bg-purple-100 text-purple-700' :
                  t.role === 'ACCOUNTANT' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }>{t.role.replace('_', ' ')}</Badge>
                <Badge variant="outline" className={t.status === 'ACTIVE' ? 'border-emerald-500 text-emerald-700' : 'border-amber-500 text-amber-700'}>
                  {t.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// ACTIVITY TAB
// ============================================================
function ActivityTab({ profile }: { profile: UserProfile }) {
  const stats = [
    { label: 'Invoices Created', value: profile.stats.invoicesCreated, icon: '📄', color: 'emerald' },
    { label: 'Bills Created', value: profile.stats.billsCreated, icon: '🧾', color: 'blue' },
    { label: 'Payments Recorded', value: profile.stats.paymentsRecorded, icon: '💳', color: 'purple' },
    { label: 'Journal Entries', value: profile.stats.journalEntries, icon: '📚', color: 'amber' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold">{s.value}</p>
                </div>
                <span className="text-3xl">{s.icon}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Account Timeline</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 border-l-2 border-emerald-500 pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Account Created</p>
              <p className="text-xs text-muted-foreground">{fmtDate(profile.createdAt)}</p>
            </div>
          </div>
          {profile.lastLoginAt && (
            <div className="flex items-center gap-3 border-l-2 border-blue-500 pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                <Activity className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Last Login</p>
                <p className="text-xs text-muted-foreground">{fmtDate(profile.lastLoginAt)}</p>
              </div>
            </div>
          )}
          {profile.tenants.map(t => (
            <div key={t.id} className="flex items-center gap-3 border-l-2 border-purple-500 pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950">
                <Building2 className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Joined {t.name}</p>
                <p className="text-xs text-muted-foreground">As {t.role.replace('_', ' ')} • {fmtDate(t.joinedAt)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
