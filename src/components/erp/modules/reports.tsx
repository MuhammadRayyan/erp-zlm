'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Printer, FileBarChart, TrendingUp, Scale, Receipt, BookOpen } from 'lucide-react'
import { fmtMoney, fmtDate, LoadingSpinner, useBusiness } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'

type ReportData = Record<string, unknown>

export function ReportsModule(_props: ModuleProps) {
  const { business } = useBusiness()
  const [reportType, setReportType] = React.useState('trial_balance')
  const [startDate, setStartDate] = React.useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0])
  const [data, setData] = React.useState<ReportData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const currency = business?.baseCurrency || 'AED'

  const reports = [
    { id: 'trial_balance', label: 'Trial Balance', icon: Scale, desc: 'All account balances at a glance' },
    { id: 'profit_loss', label: 'Profit & Loss', icon: TrendingUp, desc: 'Income statement for a period' },
    { id: 'balance_sheet', label: 'Balance Sheet', icon: FileBarChart, desc: 'Financial position as of a date' },
    { id: 'vat_return', label: 'UAE VAT Return', icon: Receipt, desc: 'Output VAT, Input VAT, Net payable' },
    { id: 'aged_receivables', label: 'Aged Receivables', icon: BookOpen, desc: 'Outstanding customer balances by age' },
    { id: 'aged_payables', label: 'Aged Payables', icon: BookOpen, desc: 'Outstanding supplier balances by age' },
    { id: 'general_ledger', label: 'General Ledger', icon: BookOpen, desc: 'All journal postings in detail' },
  ]

  const loadReport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) {
        const d = await res.json()
        setData(d)
      } else {
        console.error('Failed to load report', res.status)
      }
    } catch (err) {
      console.error('Network error', err)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { loadReport() }, [reportType])

  const printReport = () => window.print()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight">Reports</h2><p className="text-sm text-muted-foreground">Financial reports with UAE VAT compliance</p></div>
        <Button variant="outline" onClick={printReport}><Printer className="mr-2 h-4 w-4" /> Print</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {reports.map(r => {
          const Icon = r.icon
          return (
            <button key={r.id} onClick={() => { setData(null); setReportType(r.id) }} className={`text-left rounded-lg border p-4 transition-colors ${reportType === r.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted/50'}`}>
              <Icon className="h-5 w-5 text-emerald-600" />
              <p className="mt-2 font-semibold text-sm">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </button>
          )
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>{reports.find(r => r.id === reportType)?.label}</CardTitle></CardHeader>
        <CardContent>
          {(reportType === 'trial_balance' || reportType === 'balance_sheet') && (
            <div className="mb-4"><Label>As of Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-48" /></div>
          )}
          {(reportType === 'profit_loss' || reportType === 'vat_return' || reportType === 'general_ledger') && (
            <div className="mb-4 flex gap-4">
              <div><Label>From</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>
          )}
          {(reportType === 'profit_loss' || reportType === 'vat_return' || reportType === 'general_ledger') && <Button onClick={loadReport} disabled={loading} className="mb-4">Generate Report</Button>}
          {loading ? <LoadingSpinner message="Generating report..." /> : data && <ReportView type={reportType} data={data} currency={currency} />}
        </CardContent>
      </Card>
    </div>
  )
}

function ReportView({ type, data, currency }: { type: string; data: ReportData; currency: string }) {
  if (type === 'trial_balance') {
    const d = data as { rows: { code: string; name: string; type: string; debit: number; credit: number; balance: number }[]; totalDebit: number; totalCredit: number; isBalanced: boolean }
    return (
      <Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
        <TableBody>{d.rows.map((r, i) => <TableRow key={i}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-xs text-muted-foreground">{r.type}</TableCell><TableCell className="text-right">{fmtMoney(r.debit, currency)}</TableCell><TableCell className="text-right">{fmtMoney(r.credit, currency)}</TableCell></TableRow>)}
          <TableRow className="font-bold border-t-2"><TableCell colSpan={3}>Total</TableCell><TableCell className="text-right">{fmtMoney(d.totalDebit, currency)}</TableCell><TableCell className="text-right">{fmtMoney(d.totalCredit, currency)}</TableCell></TableRow>
        </TableBody>
      </Table>
    )
  }
  if (type === 'profit_loss') {
    const d = data as { income: { code: string; name: string; amount: number }[]; expenses: { code: string; name: string; amount: number }[]; totalIncome: number; totalExpenses: number; netProfit: number }
    return (
      <div className="space-y-6">
        <div><h3 className="mb-2 font-semibold">Income</h3><Table><TableBody>{d.income.map((r, i) => <TableRow key={i}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{fmtMoney(r.amount, currency)}</TableCell></TableRow>)}
          <TableRow className="font-bold border-t"><TableCell colSpan={2}>Total Income</TableCell><TableCell className="text-right text-emerald-600">{fmtMoney(d.totalIncome, currency)}</TableCell></TableRow>
        </TableBody></Table></div>
        <div><h3 className="mb-2 font-semibold">Expenses</h3><Table><TableBody>{d.expenses.map((r, i) => <TableRow key={i}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{fmtMoney(r.amount, currency)}</TableCell></TableRow>)}
          <TableRow className="font-bold border-t"><TableCell colSpan={2}>Total Expenses</TableCell><TableCell className="text-right text-red-600">{fmtMoney(d.totalExpenses, currency)}</TableCell></TableRow>
        </TableBody></Table></div>
        <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950/30"><div className="flex justify-between text-lg font-bold"><span>Net Profit</span><span className={d.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtMoney(d.netProfit, currency)}</span></div></div>
      </div>
    )
  }
  if (type === 'balance_sheet') {
    const d = data as { assets: { code: string; name: string; amount: number }[]; liabilities: { code: string; name: string; amount: number }[]; equity: { code: string; name: string; amount: number }[]; retainedEarnings: number; totalAssets: number; totalLiabilities: number; totalEquity: number; isBalanced: boolean }
    return (
      <div className="space-y-6">
        <div><h3 className="mb-2 font-semibold">Assets</h3><Table><TableBody>{d.assets.map((r, i) => <TableRow key={i}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{fmtMoney(r.amount, currency)}</TableCell></TableRow>)}</TableBody></Table>
          <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total Assets</span><span>{fmtMoney(d.totalAssets, currency)}</span></div></div>
        <div><h3 className="mb-2 font-semibold">Liabilities</h3><Table><TableBody>{d.liabilities.map((r, i) => <TableRow key={i}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{fmtMoney(r.amount, currency)}</TableCell></TableRow>)}</TableBody></Table>
          <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total Liabilities</span><span>{fmtMoney(d.totalLiabilities, currency)}</span></div></div>
        <div><h3 className="mb-2 font-semibold">Equity</h3><Table><TableBody>{d.equity.map((r, i) => <TableRow key={i}><TableCell className="font-mono text-xs">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="text-right">{fmtMoney(r.amount, currency)}</TableCell></TableRow>)}
          <TableRow><TableCell colSpan={2}>Retained Earnings</TableCell><TableCell className="text-right">{fmtMoney(d.retainedEarnings, currency)}</TableCell></TableRow></TableBody></Table>
          <div className="mt-2 flex justify-between border-t pt-2 font-bold"><span>Total Equity</span><span>{fmtMoney(d.totalEquity, currency)}</span></div></div>
        <div className={`rounded-lg p-4 ${d.isBalanced ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}><div className="flex justify-between text-lg font-bold"><span>Liabilities + Equity</span><span>{fmtMoney(d.totalLiabilities + d.totalEquity, currency)}</span></div><p className="mt-1 text-sm text-muted-foreground">{d.isBalanced ? '✓ Balance sheet is balanced' : '⚠ Balance sheet is NOT balanced'}</p></div>
      </div>
    )
  }
  if (type === 'vat_return') {
    const d = data as any
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 font-semibold">VAT Summary ({fmtDate(d.startDate || '')} to {fmtDate(d.endDate || '')})</h3>
          <Table><TableBody>
            <TableRow><TableCell>Total Sales (excluding VAT)</TableCell><TableCell className="text-right">{fmtMoney(d.totalSales, currency)}</TableCell></TableRow>
            <TableRow><TableCell>Total Purchases (excluding VAT)</TableCell><TableCell className="text-right">{fmtMoney(d.totalPurchases, currency)}</TableCell></TableRow>
            <TableRow className="font-semibold"><TableCell>Output VAT (collected on sales)</TableCell><TableCell className="text-right text-emerald-600">{fmtMoney(d.outputVAT, currency)}</TableCell></TableRow>
            <TableRow className="font-semibold"><TableCell>Input VAT (paid on purchases)</TableCell><TableCell className="text-right text-blue-600">{fmtMoney(d.inputVAT, currency)}</TableCell></TableRow>
            <TableRow className="border-t-2 font-bold text-base"><TableCell>Net VAT {d.netVAT >= 0 ? 'Payable' : 'Refundable'}</TableCell><TableCell className={`text-right ${d.netVAT >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmtMoney(Math.abs(d.netVAT), currency)}</TableCell></TableRow>
          </TableBody></Table>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Invoices in period</p><p className="text-2xl font-bold">{d.invoiceCount}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bills in period</p><p className="text-2xl font-bold">{d.billCount}</p></CardContent></Card>
        </div>
      </div>
    )
  }
  if (type === 'aged_receivables' || type === 'aged_payables') {
    const d = data as { rows: { [key: string]: string | number }[]; buckets: { current: number; days30: number; days60: number; days90: number; over90: number }; total: number }
    const isRec = type === 'aged_receivables'
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-5 gap-2 text-center">
          {[['Current', d.buckets.current], ['1-30', d.buckets.days30], ['31-60', d.buckets.days60], ['61-90', d.buckets.days90], ['90+', d.buckets.over90]].map(([label, val]) => (
            <Card key={label as string}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label as string}</p><p className="text-sm font-bold">{fmtMoney(val as number, currency)}</p></CardContent></Card>
          ))}
        </div>
        <Table><TableHeader><TableRow><TableHead>Number</TableHead><TableHead>{isRec ? 'Customer' : 'Supplier'}</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Days Overdue</TableHead></TableRow></TableHeader>
          <TableBody>{d.rows.map((r, i) => <TableRow key={i}><TableCell className="font-medium">{r[isRec ? 'invoiceNumber' : 'billNumber'] as string}</TableCell><TableCell>{r.partyName as string}</TableCell><TableCell>{fmtDate(r.dueDate as string)}</TableCell><TableCell className="text-right font-medium">{fmtMoney(r.balance as number, currency)}</TableCell><TableCell>{r.daysOverdue as number}</TableCell></TableRow>)}</TableBody>
        </Table>
        <div className="rounded-lg bg-muted p-3 font-bold">Total Outstanding: {fmtMoney(d.total, currency)}</div>
      </div>
    )
  }
  if (type === 'general_ledger') {
    const d = data as { lines: { date: string; entryNumber: string; accountCode: string; accountName: string; description: string | null; debit: number; credit: number; reference: string | null }[] }
    return <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Entry</TableHead><TableHead>Account</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
      <TableBody>{d.lines.map((l, i) => <TableRow key={i}><TableCell className="text-xs">{fmtDate(l.date)}</TableCell><TableCell className="font-mono text-xs">{l.entryNumber}</TableCell><TableCell className="text-xs"><span className="font-mono">{l.accountCode}</span> {l.accountName}</TableCell><TableCell className="text-xs">{l.description || '—'}</TableCell><TableCell className="text-right">{l.debit > 0 ? fmtMoney(l.debit, currency) : '—'}</TableCell><TableCell className="text-right">{l.credit > 0 ? fmtMoney(l.credit, currency) : '—'}</TableCell></TableRow>)}</TableBody></Table>
  }
  return null
}
