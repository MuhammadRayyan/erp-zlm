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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, ListTree, FolderTree } from 'lucide-react'
import { ACCOUNT_TYPES, ACCOUNT_SUBTYPES } from '@/lib/constants'
import { fmtMoney, fmtNumber, LoadingSpinner, EmptyState, useFetch, useBusiness } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface Account {
  id: string
  code: string
  name: string
  nameAr: string | null
  type: string
  subtype: string | null
  parentId: string | null
  description: string | null
  isControl: boolean
  isSystem: boolean
  isActive: boolean
  openingBalance: number
  hasTransactions: boolean
}

export function AccountsModule(_props: ModuleProps) {
  const { business } = useBusiness()
  const { data: accounts, loading, refetch } = useFetch<Account[]>('/api/accounts')
  const [showForm, setShowForm] = React.useState(false)
  const [editing, setEditing] = React.useState<Account | null>(null)

  const handleEdit = (acc: Account) => {
    setEditing(acc)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account?')) return
    const res = await fetch(`/api/accounts?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Account deleted'); refetch() }
    else { const e = await res.json(); toast.error(e.error || 'Failed to delete') }
  }

  if (loading) return <LoadingSpinner message="Loading accounts..." />

  // Group by type
  const grouped = ACCOUNT_TYPES.map(type => ({
    type,
    accounts: (accounts || []).filter(a => a.type === type),
  })).filter(g => g.accounts.length > 0)

  const currency = business?.baseCurrency || 'AED'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Chart of Accounts</h2>
          <p className="text-sm text-muted-foreground">Manage your accounting structure (UAE standard template)</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="mr-2 h-4 w-4" /> New Account
        </Button>
      </div>

      {accounts && accounts.length === 0 ? (
        <EmptyState title="No accounts" description="Your chart of accounts will appear here." />
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <Card key={group.type}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FolderTree className="h-5 w-5 text-emerald-600" />
                  {group.type}
                  <Badge variant="secondary" className="ml-2">{group.accounts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Subtype</TableHead>
                      <TableHead className="text-right">Opening Balance</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.accounts.map(acc => (
                      <TableRow key={acc.id}>
                        <TableCell className="font-mono font-medium">{acc.code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{acc.name}</span>
                            {acc.isControl && <Badge variant="outline" className="text-xs">Control</Badge>}
                            {acc.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                          </div>
                          {acc.nameAr && <span className="text-xs text-muted-foreground" dir="rtl">{acc.nameAr}</span>}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">{acc.subtype?.replace(/_/g, ' ') || '—'}</span>
                        </TableCell>
                        <TableCell className="text-right">{fmtMoney(acc.openingBalance, currency)}</TableCell>
                        <TableCell>
                          <Badge variant={acc.isActive ? 'default' : 'secondary'} className="text-xs">
                            {acc.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(acc)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!acc.isSystem && !acc.hasTransactions && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDelete(acc.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <AccountForm
          account={editing}
          accounts={accounts || []}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={() => { setShowForm(false); setEditing(null); refetch() }}
        />
      )}
    </div>
  )
}

function AccountForm({ account, accounts, onClose, onSaved }: {
  account: Account | null
  accounts: Account[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = React.useState({
    code: account?.code || '',
    name: account?.name || '',
    nameAr: account?.nameAr || '',
    type: account?.type || 'ASSET',
    subtype: account?.subtype || '',
    parentId: account?.parentId || '',
    description: account?.description || '',
    isControl: account?.isControl || false,
    openingBalance: account?.openingBalance || 0,
    isActive: account?.isActive ?? true,
  })
  const [saving, setSaving] = React.useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const url = account ? `/api/accounts?id=${account.id}` : '/api/accounts'
      const method = account ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { toast.success(account ? 'Account updated' : 'Account created'); onSaved() }
      else { const e = await res.json(); toast.error(e.error || 'Failed') }
    } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'New Account'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="1000" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Account name" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, subtype: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subtype</Label>
              <Select value={form.subtype} onValueChange={v => setForm({ ...form, subtype: v })}>
                <SelectTrigger><SelectValue placeholder="Select subtype" /></SelectTrigger>
                <SelectContent>
                  {(ACCOUNT_SUBTYPES[form.type] || []).map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parent Account</Label>
              <Select value={form.parentId || 'NONE'} onValueChange={v => setForm({ ...form, parentId: v === 'NONE' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (Top level)</SelectItem>
                  {accounts.filter(a => a.type === form.type && a.id !== account?.id).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Opening Balance</Label>
              <Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="ctrl" checked={form.isControl} onCheckedChange={v => setForm({ ...form, isControl: v === true })} />
              <Label htmlFor="ctrl">Control Account</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="act" checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v === true })} />
              <Label htmlFor="act">Active</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.code || !form.name}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
