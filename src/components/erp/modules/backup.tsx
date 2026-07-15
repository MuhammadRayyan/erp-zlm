'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Database,
  Download,
  Upload,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Layers,
} from 'lucide-react'
import { useFetch, LoadingSpinner, fmtDate } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'
import { toast } from 'sonner'

interface BackupStatus {
  businessId: string
  counts: Record<string, number>
  totalRecords: number
  estimatedDataSizeBytes: number
  estimatedDataSizeHuman: string
  lastBackupDate: string | null
  permissions: {
    canExportBusiness: boolean
    canExportTenant: boolean
    canExportPlatform: boolean
    canImport: boolean
  }
}

interface ImportSummaryResponse {
  ok: boolean
  conflictResolution: 'skip' | 'overwrite'
  summary: {
    imported: Record<string, number>
    skipped: Record<string, number>
    errors: { entity: string; id?: string; error: string }[]
    total: { imported: number; skipped: number }
    businesses: number
  }
  businessesImported: number
}

const ENTITY_LABELS: Record<string, string> = {
  accounts: 'Accounts',
  parties: 'Parties',
  salesInvoices: 'Sales Invoices',
  purchaseBills: 'Purchase Bills',
  quotations: 'Quotations',
  creditNotes: 'Credit Notes',
  deliveryNotes: 'Delivery Notes',
  payments: 'Payments',
  journalEntries: 'Journal Entries',
  items: 'Items',
  bankAccounts: 'Bank Accounts',
  taxRates: 'Tax Rates',
  currencies: 'Currencies',
  customFields: 'Custom Fields',
  pdfTemplates: 'PDF Templates',
}

const CSV_EXPORTS = [
  { type: 'invoices', label: 'Invoices' },
  { type: 'bills', label: 'Purchase Bills' },
  { type: 'customers', label: 'Customers' },
  { type: 'suppliers', label: 'Suppliers' },
  { type: 'items', label: 'Items' },
  { type: 'accounts', label: 'Chart of Accounts' },
  { type: 'journal', label: 'Journal Entries' },
]

export function BackupModule({ auth }: ModuleProps) {
  const { data: status, loading, refetch } = useFetch<BackupStatus>('/api/backup/status')
  const [importConflict, setImportConflict] = React.useState<'skip' | 'overwrite'>('skip')
  const [importing, setImporting] = React.useState(false)
  const [importResult, setImportResult] = React.useState<ImportSummaryResponse | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)

  if (loading) return <LoadingSpinner message="Loading backup status..." />

  // ----------------------------------------------------------------
  // EXPORT HANDLERS
  // ----------------------------------------------------------------
  const exportJson = async (scope: 'business' | 'tenant' | 'platform') => {
    try {
      const res = await fetch(`/api/backup/export?scope=${scope}`, { method: 'GET' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }))
        toast.error(err.error || `Export failed (${res.status})`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match?.[1] || `accounterp-backup-${scope}-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${scope.charAt(0).toUpperCase() + scope.slice(1)} export downloaded`)
      refetch()
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`)
    }
  }

  const exportCsv = async (type: string, label: string) => {
    try {
      const res = await fetch(`/api/export?type=${type}`, { method: 'GET' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }))
        toast.error(err.error || `Export failed (${res.status})`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match?.[1] || `${type}-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${label} CSV exported`)
    } catch (e) {
      toast.error(`CSV export failed: ${(e as Error).message}`)
    }
  }

  // ----------------------------------------------------------------
  // IMPORT HANDLERS
  // ----------------------------------------------------------------
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setImportResult(null)
  }

  const doImport = async () => {
    if (!pendingFile) {
      toast.error('Please select a backup file first')
      return
    }
    setImporting(true)
    setImportResult(null)
    try {
      const text = await pendingFile.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        toast.error('Invalid JSON file')
        setImporting(false)
        return
      }

      const res = await fetch('/api/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: parsed,
          scope: 'business',
          conflictResolution: importConflict,
        }),
      })
      const result = (await res.json()) as ImportSummaryResponse & { error?: string }
      if (!res.ok) {
        toast.error(result.error || `Import failed (${res.status})`)
        setImporting(false)
        return
      }
      setImportResult(result)
      toast.success(
        `Import complete: ${result.summary.total.imported} imported, ${result.summary.total.skipped} skipped`
      )
      refetch()
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`)
    } finally {
      setImporting(false)
      setPendingFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!status) {
    // Handle case where API returns error (e.g., not authenticated)
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-emerald-600" />
            Backup &amp; Data Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Export and import your business data, download CSV reports, and monitor data size.
          </p>
        </div>
        {loading ? (
          <LoadingSpinner message="Loading backup status..." />
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-sm text-amber-700 dark:text-amber-400">Unable to load backup status. Please ensure you are logged in.</p>
          </div>
        )}
      </div>
    )
  }

  // Ensure status has all required fields with defaults
  const safeStatus: BackupStatus = {
    businessId: status.businessId || '',
    counts: status.counts || {},
    totalRecords: status.totalRecords || 0,
    estimatedDataSizeBytes: status.estimatedDataSizeBytes || 0,
    estimatedDataSizeHuman: status.estimatedDataSizeHuman || '0 B',
    lastBackupDate: status.lastBackupDate || null,
    permissions: status.permissions || { canExportBusiness: false, canExportTenant: false, canExportPlatform: false, canImport: false },
  }

  const isPlatformAdmin = auth.user.role === 'PLATFORM_ADMIN'
  const isTenantAdmin = auth.currentTenantRole === 'TENANT_ADMIN' || isPlatformAdmin

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6 text-emerald-600" />
          Backup &amp; Data Management
        </h2>
        <p className="text-sm text-muted-foreground">
          Export and import your business data, download CSV reports, and monitor data size.
        </p>
      </div>

      {/* ============ DATA STATS ============ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="mt-1 text-2xl font-bold">{safeStatus.totalRecords.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">across all entities</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500 text-white">
                <Layers className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Data Size</p>
                <p className="mt-1 text-2xl font-bold">{safeStatus.estimatedDataSizeHuman}</p>
                <p className="mt-1 text-xs text-muted-foreground">approximate export size</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-500 text-white">
                <HardDrive className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Backup</p>
                <p className="mt-1 text-2xl font-bold">
                  {safeStatus.lastBackupDate ? fmtDate(safeStatus.lastBackupDate) : 'Never'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {safeStatus.lastBackupDate ? 'previous JSON export' : 'no backups yet'}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ============ EXPORT SECTION ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Export Data
            </CardTitle>
            <CardDescription>
              Download a full JSON backup (for restore/migration) or a CSV of a single entity.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-semibold">JSON Backups</h4>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => exportJson('business')} variant="default" size="sm">
                  <FileJson className="mr-2 h-4 w-4" /> Export Business Data (JSON)
                </Button>
                {safeStatus.permissions.canExportTenant && (
                  <Button
                    onClick={() => exportJson('tenant')}
                    variant="outline"
                    size="sm"
                    title="Export all businesses in your organization"
                  >
                    <Building2 className="mr-2 h-4 w-4" /> Export Tenant Data (JSON)
                  </Button>
                )}
                {safeStatus.permissions.canExportPlatform && (
                  <Button
                    onClick={() => exportJson('platform')}
                    variant="outline"
                    size="sm"
                    title="Platform admin: export all tenants"
                  >
                    <Database className="mr-2 h-4 w-4" /> Export Platform (JSON)
                  </Button>
                )}
              </div>
              {!safeStatus.permissions.canExportTenant && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tenant export requires Tenant Admin role.
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-semibold">CSV Exports</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CSV_EXPORTS.map(ex => (
                  <Button
                    key={ex.type}
                    onClick={() => exportCsv(ex.type, ex.label)}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{ex.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============ IMPORT SECTION ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import Data
            </CardTitle>
            <CardDescription>
              Restore a previously-exported JSON backup into this business.
              {!isTenantAdmin && (
                <span className="mt-1 block text-xs text-amber-600">
                  You need Tenant Admin or Platform Admin rights to import data.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-sm font-medium">1. Select a backup file</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={onFileSelected}
                disabled={!isTenantAdmin || importing}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-white hover:file:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {pendingFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected: <span className="font-medium">{pendingFile.name}</span> ({(pendingFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm font-medium">2. Conflict resolution</Label>
              <RadioGroup
                value={importConflict}
                onValueChange={v => setImportConflict(v as 'skip' | 'overwrite')}
                className="mt-2 space-y-2"
                disabled={!isTenantAdmin || importing}
              >
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value="skip" id="r-skip" className="mt-0.5" />
                  <div>
                    <Label htmlFor="r-skip" className="cursor-pointer font-medium">
                      Skip existing
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Leave existing records untouched when a duplicate (same number, code, or name) is found. Safest option.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <RadioGroupItem value="overwrite" id="r-overwrite" className="mt-0.5" />
                  <div>
                    <Label htmlFor="r-overwrite" className="cursor-pointer font-medium">
                      Overwrite existing
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Update existing records in place with the values from the backup. May re-create child lines.
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium">3. Confirm and import</Label>
              <div className="mt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!isTenantAdmin || importing || !pendingFile} className="w-full sm:w-auto">
                      <Upload className="mr-2 h-4 w-4" />
                      {importing ? 'Importing...' : 'Import Backup'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm import?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will import data from <span className="font-medium">{pendingFile?.name}</span> into the current business.
                        {importConflict === 'overwrite' ? (
                          <span className="mt-2 block text-amber-600">
                            ⚠ Overwrite mode: existing records with matching numbers/codes/names WILL be updated.
                          </span>
                        ) : (
                          <span className="mt-2 block text-emerald-600">
                            ✓ Skip mode: existing records will be left untouched.
                          </span>
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={doImport} disabled={importing}>
                        {importing ? 'Importing...' : 'Yes, Import'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Import results */}
            {importResult && (
              <div className="rounded-md border bg-muted/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-semibold">Import Complete</h4>
                  <Badge variant="outline" className="ml-auto">
                    {importResult.conflictResolution} mode
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Imported</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {importResult.summary.total.imported}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Skipped</p>
                    <p className="text-lg font-bold text-amber-600">
                      {importResult.summary.total.skipped}
                    </p>
                  </div>
                </div>

                {Object.keys(importResult.summary.imported).length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Imported by entity:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(importResult.summary.imported).map(([k, v]) =>
                        v > 0 ? (
                          <Badge key={k} variant="secondary" className="text-xs">
                            {ENTITY_LABELS[k] || k}: {v}
                          </Badge>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {Object.keys(importResult.summary.skipped).length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Skipped by entity:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(importResult.summary.skipped).map(([k, v]) =>
                        v > 0 ? (
                          <Badge key={k} variant="outline" className="text-xs">
                            {ENTITY_LABELS[k] || k}: {v}
                          </Badge>
                        ) : null
                      )}
                    </div>
                  </div>
                )}

                {importResult.summary.errors.length > 0 && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-3.5 w-3.5" /> {importResult.summary.errors.length} error(s):
                    </p>
                    <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-red-700 dark:text-red-400">
                      {importResult.summary.errors.slice(0, 20).map((e, i) => (
                        <li key={i}>
                          <span className="font-mono">{e.entity}</span>
                          {e.id ? ` ${e.id}` : ''}: {e.error}
                        </li>
                      ))}
                      {importResult.summary.errors.length > 20 && (
                        <li className="italic">... and {importResult.summary.errors.length - 20} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============ RECORD COUNTS BREAKDOWN ============ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" /> Record Counts
          </CardTitle>
          <CardDescription>Breakdown of records stored for the current business.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            <CountTile label="Invoices" value={safeStatus.counts.invoices} color="emerald" />
            <CountTile label="Bills" value={safeStatus.counts.bills} color="blue" />
            <CountTile label="Customers" value={safeStatus.counts.customers} color="purple" />
            <CountTile label="Suppliers" value={safeStatus.counts.suppliers} color="amber" />
            <CountTile label="Items" value={safeStatus.counts.items} color="cyan" />
            <CountTile label="Journal Entries" value={safeStatus.counts.journalEntries} color="rose" />
            <CountTile label="Payments" value={safeStatus.counts.payments} color="emerald" />
            <CountTile label="Quotations" value={safeStatus.counts.quotations} color="blue" />
            <CountTile label="Credit Notes" value={safeStatus.counts.creditNotes} color="purple" />
            <CountTile label="Delivery Notes" value={safeStatus.counts.deliveryNotes} color="amber" />
            <CountTile label="Accounts" value={safeStatus.counts.accounts} color="cyan" />
            <CountTile label="Bank Accounts" value={safeStatus.counts.bankAccounts} color="rose" />
          </div>

          {/* Relative distribution bar */}
          <div className="mt-6">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Distribution of records</span>
              <span>{safeStatus.totalRecords.toLocaleString()} total</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {safeStatus.totalRecords > 0 &&
                Object.entries(safeStatus.counts).map(([k, v]) => {
                  if (v === 0) return null
                  const pct = (v / safeStatus.totalRecords) * 100
                  const colors: Record<string, string> = {
                    invoices: 'bg-emerald-500',
                    bills: 'bg-blue-500',
                    customers: 'bg-purple-500',
                    suppliers: 'bg-amber-500',
                    items: 'bg-cyan-500',
                    journalEntries: 'bg-rose-500',
                    payments: 'bg-emerald-400',
                    quotations: 'bg-blue-400',
                    creditNotes: 'bg-purple-400',
                    deliveryNotes: 'bg-amber-400',
                    accounts: 'bg-cyan-400',
                    parties: 'bg-rose-400',
                    bankAccounts: 'bg-indigo-500',
                    taxRates: 'bg-pink-500',
                    currencies: 'bg-teal-500',
                    customFields: 'bg-orange-500',
                    pdfTemplates: 'bg-lime-500',
                  }
                  return (
                    <div
                      key={k}
                      className={colors[k] || 'bg-gray-500'}
                      style={{ width: `${pct}%` }}
                      title={`${ENTITY_LABELS[k] || k}: ${v}`}
                    />
                  )
                })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage usage indicator (visual) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Estimated storage used by this business</p>
              <p className="text-xs text-muted-foreground">
                Based on row counts × average record size. Actual JSON export size may vary.
              </p>
            </div>
            <Badge variant="outline">{safeStatus.estimatedDataSizeHuman}</Badge>
          </div>
          <Progress value={Math.min(100, (status.estimatedDataSizeBytes / (10 * 1024 * 1024)) * 100)} className="mt-3" />
          <p className="mt-1 text-xs text-muted-foreground">10 MB soft cap indicator (your plan may differ)</p>
        </CardContent>
      </Card>
    </div>
  )
}

function CountTile({ label, value, color }: {
  label: string
  value: number
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'cyan' | 'rose'
}) {
  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    purple: 'border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30',
    amber: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
    cyan: 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30',
    rose: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
  }
  return (
    <div className={`rounded-lg border p-3 ${colorMap[color]}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  )
}
