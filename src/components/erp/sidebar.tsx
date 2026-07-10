'use client'

import * as React from 'react'
import Link from 'next/link'
import { NAV_GROUPS } from '@/lib/nav'
import { LayoutDashboard, FileText, Receipt, FileMinus, Truck, Users, ShoppingCart, Building2, CreditCard, Landmark, ListTree, BookOpen, BarChart3, Package, FileEdit, Settings2, Settings, ChevronLeft, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, FileText, Receipt, FileMinus, Truck, Users, ShoppingCart, Building2,
  CreditCard, Landmark, ListTree, BookOpen, BarChart3, Package, FileEdit, Settings2, Settings,
}

interface SidebarProps {
  activeModule: string
  onNavigate: (m: string) => void
}

export function Sidebar({ activeModule, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(false)

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
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">AccountERP</span>
            <span className="text-[10px] text-muted-foreground">UAE Edition</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={() => setCollapsed(!collapsed)}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUPS.map(group => (
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
                    isActive && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
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
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t p-3">
          <div className="rounded-lg bg-emerald-50 p-3 text-xs dark:bg-emerald-950/30">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">VAT Compliant</p>
            <p className="mt-0.5 text-muted-foreground">UAE FTA • 5% Standard Rate</p>
          </div>
        </div>
      )}
    </aside>
  )
}
