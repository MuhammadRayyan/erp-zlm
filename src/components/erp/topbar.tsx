'use client'

import * as React from 'react'
import { useTheme } from '@/components/theme-provider'
import { Moon, Sun, Building2, Bell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MODULE_LABELS } from '@/lib/nav'
import type { Business } from './app-shell'

interface TopbarProps {
  business: Business | null
  module: string
}

export function Topbar({ business, module }: TopbarProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">{MODULE_LABELS[module] || 'Dashboard'}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="h-9 w-48 pl-9 lg:w-64"
          />
        </div>

        {/* Business name */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5">
          <Building2 className="h-4 w-4 text-emerald-600" />
          <span className="hidden text-sm font-medium md:inline">{business?.name || 'No Business'}</span>
        </div>

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
