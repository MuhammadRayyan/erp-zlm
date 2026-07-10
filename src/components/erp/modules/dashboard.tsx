'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, TrendingDown, Wallet, Users, FileText, AlertTriangle, ArrowRight, Receipt } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { fmtMoney, fmtDate, StatusBadge, StatCard, LoadingSpinner, EmptyState } from '../shared/ui-helpers'
import type { ModuleProps } from '../app-shell'

export function Dashboard({ business, navigate }: ModuleProps) {
  const { data, loading } = useDashboardData()

  if (loading || !data) return <LoadingSpinner message="Loading dashboard..." />

  const currency = business?.baseCurrency || 'AED'
  const incomeChange = data.kpis.prevMonthIncome > 0
    ? ((data.kpis.monthIncome - data.kpis.prevMonthIncome) / data.kpis.prevMonthIncome) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back to {business?.name || 'AccountERP'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Receivables"
          value={fmtMoney(data.kpis.totalReceivables, currency)}
          subtitle={`${data.counts.overdueInvoices} overdue invoices`}
          icon={Wallet}
          color="emerald"
        />
        <StatCard
          title="Total Payables"
          value={fmtMoney(data.kpis.totalPayables, currency)}
          subtitle="Outstanding bills"
          icon={Receipt}
          color="red"
        />
        <StatCard
          title="This Month Income"
          value={fmtMoney(data.kpis.monthIncome, currency)}
          trend={{ value: incomeChange, label: 'vs last month' }}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="This Month Expenses"
          value={fmtMoney(data.kpis.monthExpenses, currency)}
          subtitle={`Net: ${fmtMoney(data.kpis.netCashFlow, currency)}`}
          icon={TrendingDown}
          color="amber"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs Expenses (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  formatter={(v: number) => fmtMoney(v, currency)}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f59e0b" name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickStat label="Total Invoices" value={data.counts.invoices} icon={FileText} onClick={() => navigate('invoices')} />
            <QuickStat label="Draft Invoices" value={data.counts.draftInvoices} icon={FileText} onClick={() => navigate('invoices')} />
            <QuickStat label="Overdue Invoices" value={data.counts.overdueInvoices} icon={AlertTriangle} color="text-red-600" onClick={() => navigate('invoices')} />
            <QuickStat label="Customers" value={data.counts.customers} icon={Users} onClick={() => navigate('customers')} />
            <QuickStat label="Suppliers" value={data.counts.suppliers} icon={Users} onClick={() => navigate('suppliers')} />
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices + Overdue */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('invoices')}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length === 0 ? (
              <EmptyState title="No invoices yet" description="Create your first invoice to get started." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentInvoices.map((inv: { id: string; number: string; partyName: string; total: number; status: string; date: string }) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer"
                      onClick={() => navigate('invoices', { action: 'view', id: inv.id })}
                    >
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell>{inv.partyName}</TableCell>
                      <TableCell className="text-right font-medium">{fmtMoney(inv.total, currency)}</TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Overdue Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('invoices')}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.overdueInvoices.length === 0 ? (
              <EmptyState title="No overdue invoices" description="All your invoices are up to date." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdueInvoices.map((inv: { id: string; number: string; partyName: string; dueDate: string; total: number; amountPaid: number }) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer"
                      onClick={() => navigate('invoices', { action: 'view', id: inv.id })}
                    >
                      <TableCell className="font-medium">{inv.number}</TableCell>
                      <TableCell>{inv.partyName}</TableCell>
                      <TableCell className="text-red-600">{fmtDate(inv.dueDate)}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{fmtMoney(inv.total - inv.amountPaid, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <QuickAction label="New Invoice" icon={FileText} onClick={() => navigate('invoices', { action: 'new' })} />
            <QuickAction label="New Bill" icon={Receipt} onClick={() => navigate('bills', { action: 'new' })} />
            <QuickAction label="New Customer" icon={Users} onClick={() => navigate('customers', { action: 'new' })} />
            <QuickAction label="Journal Entry" icon={FileText} onClick={() => navigate('journal', { action: 'new' })} />
            <QuickAction label="Reports" icon={TrendingUp} onClick={() => navigate('reports')} />
            <QuickAction label="Settings" icon={Receipt} onClick={() => navigate('settings')} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function QuickStat({ label, value, icon: Icon, color, onClick }: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-lg font-bold">{value}</span>
    </button>
  )
}

function QuickAction({ label, icon: Icon, onClick }: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30"
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

// Fetch dashboard data
function useDashboardData() {
  const [data, setData] = React.useState<null | {
    kpis: { totalReceivables: number; totalPayables: number; monthIncome: number; prevMonthIncome: number; monthExpenses: number; netCashFlow: number }
    counts: { invoices: number; bills: number; customers: number; suppliers: number; draftInvoices: number; overdueInvoices: number }
    recentInvoices: { id: string; number: string; partyName: string; total: number; status: string; date: string }[]
    overdueInvoices: { id: string; number: string; partyName: string; dueDate: string; total: number; amountPaid: number }[]
    monthlyRevenue: { month: string; revenue: number; expenses: number }[]
  }>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
