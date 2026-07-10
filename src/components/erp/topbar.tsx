'use client'

import * as React from 'react'
import { useTheme } from '@/components/theme-provider'
import { Moon, Sun, Building2, Bell, Search, ChevronDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MODULE_LABELS } from '@/lib/nav'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import type { AuthState } from './app-shell'
import { toast } from 'sonner'

interface TopbarProps {
  auth: AuthState
  module: string
  onRefresh: () => void
}

export function Topbar({ auth, module, onRefresh }: TopbarProps) {
  const { theme, toggleTheme } = useTheme()

  const switchTenant = async (tenantId: string) => {
    const res = await fetch('/api/auth/switch-tenant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    if (res.ok) {
      toast.success('Tenant switched')
      onRefresh()
      // Reload to refresh business context
      window.location.reload()
    }
  }

  const switchBusiness = async (businessId: string) => {
    document.cookie = `accounterp_business=${businessId}; path=/; max-age=${60 * 60 * 24 * 365}`
    toast.success('Business switched')
    window.location.reload()
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">{MODULE_LABELS[module] || 'Dashboard'}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="h-9 w-48 pl-9 lg:w-64" />
        </div>

        {/* Tenant switcher */}
        {auth.tenants.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                <span className="hidden max-w-[120px] truncate md:inline">
                  {auth.tenants.find(t => t.id === auth.currentTenantId)?.name || auth.tenants[0].name}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {auth.tenants.map(t => (
                <DropdownMenuItem key={t.id} onClick={() => switchTenant(t.id)} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.role} • {t.plan}</span>
                  </div>
                  {t.id === auth.currentTenantId && <Check className="h-4 w-4 text-emerald-600" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Business switcher */}
        <BusinessSwitcher onSwitch={switchBusiness} />

        {/* Role badge */}
        <Badge variant="outline" className="hidden text-xs md:inline-flex">
          {auth.currentTenantRole || auth.user.role}
        </Badge>

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500" />
        </Button>
      </div>
    </header>
  )
}

function BusinessSwitcher({ onSwitch }: { onSwitch: (id: string) => void }) {
  const [businesses, setBusinesses] = React.useState<{ id: string; name: string; trn: string | null }[]>([])
  const [currentId, setCurrentId] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch('/api/tenant/businesses')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setBusinesses(d)
          setCurrentId(d.find((b: { isCurrent: boolean }) => b.isCurrent)?.id || d[0]?.id || null)
        }
      })
      .catch(() => {})
  }, [])

  if (businesses.length === 0) return null

  const current = businesses.find(b => b.id === currentId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="h-4 w-4 text-blue-600" />
          <span className="hidden max-w-[120px] truncate md:inline">{current?.name || 'Business'}</span>
          {businesses.length > 1 && <ChevronDown className="h-3 w-3" />}
        </Button>
      </DropdownMenuTrigger>
      {businesses.length > 1 && (
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Switch Business</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {businesses.map(b => (
            <DropdownMenuItem key={b.id} onClick={() => onSwitch(b.id)} className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{b.name}</span>
                {b.trn && <span className="text-xs text-muted-foreground">TRN: {b.trn}</span>}
              </div>
              {b.id === currentId && <Check className="h-4 w-4 text-emerald-600" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
