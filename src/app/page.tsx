import { Suspense } from 'react'
import { AppShell } from '@/components/erp/app-shell'

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading AccountERP...</div>
      </div>
    }>
      <AppShell />
    </Suspense>
  )
}
