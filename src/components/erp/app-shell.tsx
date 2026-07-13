'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MODULE_LABELS } from '@/lib/nav'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Dashboard } from './modules/dashboard'
import { AccountsModule } from './modules/accounts'
import { JournalModule } from './modules/journal'
import { PartiesModule } from './modules/parties'
import { InvoicesModule } from './modules/invoices'
import { BillsModule } from './modules/bills'
import { PaymentsModule } from './modules/payments'
import { QuotationsModule } from './modules/quotations'
import { CreditNotesModule } from './modules/credit-notes'
import { DeliveryNotesModule } from './modules/delivery-notes'
import { ItemsModule } from './modules/items'
import { BankingModule } from './modules/banking'
import { ReportsModule } from './modules/reports'
import { TemplatesModule } from './modules/templates'
import { CustomFieldsModule } from './modules/custom-fields'
import { SettingsModule } from './modules/settings'
import { AdminPortal } from './modules/admin-portal'
import { TenantPortal } from './modules/tenant-portal'
import { AuthScreen } from './auth-screen'
import { ModuleErrorBoundary } from './error-boundary'

export interface Business {
  id: string
  name: string
  legalName: string | null
  trn: string | null
  email: string | null
  phone: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  country: string
  baseCurrency: string
  vatRegistered: boolean
  vatRate: string | number
  invoicePrefix: string
  billPrefix: string
  tenantId: string
  [key: string]: unknown
}

export interface AuthState {
  authenticated: boolean
  user: { id: string; email: string; name: string; role: string }
  tenants: { id: string; name: string; slug: string; role: string; status: string; plan: string }[]
  currentTenantId: string | null
  currentTenantRole: string | null
  currentBusinessId: string | null
  currentBusinessName: string | null
}

export function AppShell() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeModule = searchParams.get('m') || 'dashboard'
  const [auth, setAuth] = React.useState<AuthState | null>(null)
  const [loading, setLoading] = React.useState(true)

  const checkAuth = React.useCallback(async () => {
    try {
      // Ensure seeded
      const initRes = await fetch('/api/init', { method: 'POST' })
      // Ignore init result — may already be seeded

      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setAuth(data)
    } catch (e) {
      console.error('Auth check error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const navigate = (m: string, params?: Record<string, string>) => {
    const sp = new URLSearchParams({ m, ...params })
    router.push(`/?${sp.toString()}`)
  }

  const refreshAuth = () => checkAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading AccountERP...</p>
        </div>
      </div>
    )
  }

  if (!auth?.authenticated) {
    return <AuthScreen onAuthed={refreshAuth} />
  }

  const isPlatformAdmin = auth.user.role === 'PLATFORM_ADMIN'

  const moduleProps = { business: null, navigate, searchParams, auth, refreshAuth }

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <Dashboard {...moduleProps} />
      case 'accounts': return <AccountsModule {...moduleProps} />
      case 'journal': return <JournalModule {...moduleProps} />
      case 'customers':
      case 'suppliers': return <PartiesModule {...moduleProps} partyType={activeModule === 'customers' ? 'CUSTOMER' : 'SUPPLIER'} />
      case 'invoices': return <InvoicesModule {...moduleProps} />
      case 'bills': return <BillsModule {...moduleProps} />
      case 'payments': return <PaymentsModule {...moduleProps} />
      case 'quotations': return <QuotationsModule {...moduleProps} />
      case 'credit-notes': return <CreditNotesModule {...moduleProps} />
      case 'delivery-notes': return <DeliveryNotesModule {...moduleProps} />
      case 'items': return <ItemsModule {...moduleProps} />
      case 'banking': return <BankingModule {...moduleProps} />
      case 'reports': return <ReportsModule {...moduleProps} />
      case 'templates': return <TemplatesModule {...moduleProps} />
      case 'custom-fields': return <CustomFieldsModule {...moduleProps} />
      case 'settings': return <SettingsModule {...moduleProps} />
      case 'admin-portal': return <AdminPortal {...moduleProps} />
      case 'tenant-portal': return <TenantPortal {...moduleProps} />
      default: return <Dashboard {...moduleProps} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeModule={activeModule} onNavigate={navigate} auth={auth} onLogout={refreshAuth} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar auth={auth} module={activeModule} onRefresh={refreshAuth} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 md:p-6">
            <ModuleErrorBoundary moduleName={MODULE_LABELS[activeModule] || activeModule}>
            {renderModule()}
            </ModuleErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

export type ModuleProps = {
  business: Business | null
  navigate: (m: string, params?: Record<string, string>) => void
  searchParams: URLSearchParams
  auth: AuthState
  refreshAuth: () => void
}
