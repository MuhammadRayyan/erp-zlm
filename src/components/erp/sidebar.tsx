'use client'

import * as React from 'react'
import { NAV_GROUPS } from '@/lib/nav'
import { LayoutDashboard, FileText, Receipt, FileMinus, Truck, Users, ShoppingCart, Building2, CreditCard, Landmark, ListTree, BookOpen, BarChart3, Package, FileEdit, Settings2, Settings, ChevronLeft, Calculator, Shield, UserCog, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { AuthState } from './app-shell'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, FileText, Receipt, FileMinus, Truck, Users, ShoppingCart, Building2,
  CreditCard, Landmark, ListTree, BookOpen, BarChart3, Package, FileEdit, Settings2, Settings,
}

interface SidebarProps {
  activeModule: string
  onNavigate: (m: string) => void
  auth: AuthState
  onLogout: () => void
}

export function Sidebar({ activeModule, onNavigate, auth, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const isPlatformAdmin = auth.user.role === 'PLATFORM_ADMIN'

  // Build nav groups based on role
  const groups = [...NAV_GROUPS]

  // Add admin section for platform admin
  if (isPlatformAdmin) {
    groups.push({
      group: 'Administration',
      items: [
        { id: 'admin-portal', label: 'Platform Admin', icon: 'Shield', group: 'Administration' },
        { id: 'tenant-portal', label: 'Tenant Settings', icon: 'UserCog', group: 'Administration' },
      ],
    })
  } else {
    // Tenant admin sees tenant portal
    groups.push({
      group: 'Administration',
      items: [
        { id: 'tenant-portal', label: 'Organization Settings', icon: 'UserCog', group: 'Administration' },
      ],
    })
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    onLogout()
  }

  return (
    <aside className={cn(
      "flex flex-col border-r bg-sidebar transition-all duration-200",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white">
          <Calculator className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold tracking-tight">AccountERP</span>
            <span className="text-[10px] text-muted-foreground truncate">
              {auth.currentBusinessName || auth.tenants[0]?.name || 'No Business'}
            </span>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setCollapsed(!collapsed)}>
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map(group => {
          // Hide some groups for viewers
          if (auth.currentTenantRole === 'VIEWER' && group.group === 'System') return null
          return (
            <div key={group.group} className="mb-1">
              {!collapsed && (
                <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.group}
                </div>
              )}
              {group.items.map(item => {
                const Icon = ICONS[item.icon] || LayoutDashboard
                const isActive = activeModule === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 shadow-sm",
                      collapsed && "justify-center px-2",
                      !isActive && "text-sidebar-foreground/80"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User info & logout */}
      <div className="border-t p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
                {auth.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{auth.user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{auth.user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-red-600 hover:text-red-700" onClick={handleLogout}>
              <LogOut className="mr-2 h-3.5 w-3.5" /> Logout
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="w-full text-red-600" onClick={handleLogout} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  )
}
