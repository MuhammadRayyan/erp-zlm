'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckSquare, Check, X, Clock, AlertTriangle, ShieldCheck } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, EmptyState, useFetch } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

// ============================================================
// APPROVALS MODULE
// ============================================================
//
// Lists pending / approved / rejected invoices, bills, and payments.
// Only tenant admins can approve or reject; other roles see read-only.
// ============================================================

interface ApprovalSettings {
  requireApproval: boolean
  invoiceThreshold: number
  billThreshold: number
  paymentThreshold: number
}

interface ApprovalListItem {
  id: string
  type: 'SALES_INVOICE' | 'PURCHASE_BILL' | 'PAYMENT'
  number: string
  date: string
  partyId: string
  partyName: string
  amount: number
  currency: string
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvalAmount: number | null
  approvedBy: string | null
  approvedAt: string | null
  createdById: string
  createdByName: string | null
  createdAt: string
}

const TYPE_LABELS: Record<ApprovalListItem['type'], string> = {
  SALES_INVOICE: 'Sales Invoice',
  PURCHASE_BILL: 'Purchase Bill',
  PAYMENT: 'Payment',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
}

export function ApprovalsModule(props: ModuleProps) {
  const [statusFilter, setStatusFilter] = React.useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const { data, loading, refetch } = useFetch<{ items: ApprovalListItem[]; settings: ApprovalSettings }>(
    `/api/approvals?status=${statusFilter}`,
    [statusFilter],
  )
  const [rejectTarget, setRejectTarget] = React.useState<ApprovalListItem | null>(null)
  const [rejectReason, setRejectReason] = React.useState('')
  const [processing, setProcessing] = React.useState<string | null>(null)

  const isTenantAdmin =
    props.auth.user.role === 'PLATFORM_ADMIN' ||
    props.auth.currentTenantRole === 'TENANT_ADMIN'

  const items = data?.items || []
  const settings = data?.settings

  const approve = async (item: ApprovalListItem) => {
    if (!isTenantAdmin) {
      toast.error('Only tenant administrators can approve documents')
      return
    }
    setProcessing(item.id)
    try {
      const res = await fetch(`/api/approvals/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', type: item.type }),
      })
      if (res.ok) {
        toast.success(`${TYPE_LABELS[item.type]} ${item.number} approved and posted`)
        refetch()
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || 'Failed to approve')
      }
    } finally {
      setProcessing(null)
    }
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    setProcessing(rejectTarget.id)
    try {
      const res = await fetch(`/api/approvals/${rejectTarget.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', type: rejectTarget.type, reason: rejectReason }),
      })
      if (res.ok) {
        toast.success(`${TYPE_LABELS[rejectTarget.type]} ${rejectTarget.number} rejected`)
        setRejectTarget(null)
        setRejectReason('')
        refetch()
      } else {
        const e = await res.json().catch(() => ({}))
        toast.error(e.error || 'Failed to reject')
      }
    } finally {
      setProcessing(null)
    }
  }

  if (loading && !data) return <LoadingSpinner message="Loading approvals..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approvals</h2>
          <p className="text-sm text-muted-foreground">
            Review and approve invoices, bills, and payments above the configured thresholds.
          </p>
        </div>
      </div>

      {/* Approval settings summary card */}
      {settings && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Approval Workflow
              <Badge variant="outline" className={settings.requireApproval ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>
                {settings.requireApproval ? 'Enabled' : 'Disabled'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Configure thresholds in <span className="font-medium">Settings → Approvals</span>. Only tenant administrators can approve or reject documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ThresholdCard label="Invoice Threshold" value={settings.invoiceThreshold} enabled={settings.requireApproval} />
              <ThresholdCard label="Bill Threshold" value={settings.billThreshold} enabled={settings.requireApproval} />
              <ThresholdCard label="Payment Threshold" value={settings.paymentThreshold} enabled={settings.requireApproval} />
            </div>
          </CardContent>
        </Card>
      )}

      {!isTenantAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>You have read-only access. Only tenant administrators can approve or reject documents.</span>
        </div>
      )}

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'PENDING' | 'APPROVED' | 'REJECTED')}>
        <TabsList>
          <TabsTrigger value="PENDING"><Clock className="mr-2 h-3.5 w-3.5" />Pending</TabsTrigger>
          <TabsTrigger value="APPROVED"><Check className="mr-2 h-3.5 w-3.5" />Approved</TabsTrigger>
          <TabsTrigger value="REJECTED"><X className="mr-2 h-3.5 w-3.5" />Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <EmptyState
          title={`No ${statusFilter.toLowerCase()} documents`}
          description={
            statusFilter === 'PENDING'
              ? 'Documents submitted for approval will appear here.'
              : `No ${statusFilter.toLowerCase()} documents to display.`
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4" />
              {statusFilter === 'PENDING' ? 'Pending Approvals' : statusFilter === 'APPROVED' ? 'Approved Documents' : 'Rejected Documents'}
              <Badge variant="outline" className="ml-1">{items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  {statusFilter !== 'PENDING' && <TableHead>Decision</TableHead>}
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={`${item.type}-${item.id}`}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[item.type]}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.number}</TableCell>
                    <TableCell>{item.partyName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{item.createdByName || '—'}</TableCell>
                    <TableCell className="text-xs">{fmtDate(item.date)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(item.amount, item.currency)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[item.approvalStatus]}>
                        {item.approvalStatus}
                      </Badge>
                    </TableCell>
                    {statusFilter !== 'PENDING' && (
                      <TableCell className="text-xs text-muted-foreground">
                        {item.approvedAt ? fmtDate(item.approvedAt) : '—'}
                      </TableCell>
                    )}
                    <TableCell>
                      {statusFilter === 'PENDING' && isTenantAdmin && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7"
                            disabled={processing === item.id}
                            onClick={() => approve(item)}
                          >
                            <Check className="mr-1 h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-red-600 hover:text-red-700"
                            disabled={processing === item.id}
                            onClick={() => { setRejectTarget(item); setRejectReason('') }}
                          >
                            <X className="mr-1 h-3 w-3" /> Reject
                          </Button>
                        </div>
                      )}
                      {statusFilter === 'PENDING' && !isTenantAdmin && (
                        <span className="text-xs text-muted-foreground">Read-only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget ? `${TYPE_LABELS[rejectTarget.type]} ${rejectTarget.number}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Amount mismatch with supporting documents"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Rejection is recorded in the audit log. The document will not be posted; the requester can edit and resubmit.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason('') }}>Cancel</Button>
            <Button variant="destructive" disabled={!!processing} onClick={submitReject}>
              {processing ? 'Rejecting...' : 'Reject Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ThresholdCard({ label, value, enabled }: { label: string; value: number; enabled: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${enabled ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/30'}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold">{fmtMoney(value)}</div>
      <div className="text-xs text-muted-foreground">
        {enabled ? 'Above threshold requires approval' : 'Workflow disabled'}
      </div>
    </div>
  )
}
