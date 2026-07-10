'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  [key: string]: unknown
}

export function AppShell() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeModule = searchParams.get('m') || 'dashboard'
  const [business, setBusiness] = React.useState<Business | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    initApp()
  }, [])

  async function initApp() {
    try {
      // Ensure data is seeded
      await fetch('/api/init', { method: 'POST' })
      // Get current business
      const res = await fetch('/api/business')
      if (res.ok) {
        const b = await res.json()
        setBusiness(b)
      }
    } catch (e) {
      console.error('Init error:', e)
    } finally {
      setLoading(false)
    }
  }

  const navigate = (m: string, params?: Record<string, string>) => {
    const sp = new URLSearchParams({ m, ...params })
    router.push(`/?${sp.toString()}`)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Initializing AccountERP...</p>
        </div>
      </div>
    )
  }

  const moduleProps = { business, navigate, searchParams }

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
      default: return <Dashboard {...moduleProps} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeModule={activeModule} onNavigate={navigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar business={business} module={activeModule} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 md:p-6">
            {renderModule()}
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
}
