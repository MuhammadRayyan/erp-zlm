'use client'

import * as React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, FileText, ShoppingCart, Users, Package, ListTree, BookOpen, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: string
  id: string
  title: string
  subtitle: string
  meta?: string
  url: string
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice: FileText,
  bill: ShoppingCart,
  customer: Users,
  supplier: Users,
  both: Users,
  item: Package,
  account: ListTree,
  journal: BookOpen,
}

export function GlobalSearch({ open, onOpenChange, onNavigate }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (url: string) => void
}) {
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  React.useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data.results || [])
        setSelectedIndex(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  const handleSelect = (result: SearchResult) => {
    onNavigate(result.url)
    onOpenChange(false)
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r)
    return acc
  }, {})

  const typeLabels: Record<string, string> = {
    invoice: 'Invoices',
    bill: 'Bills',
    customer: 'Customers',
    supplier: 'Suppliers',
    both: 'Parties',
    item: 'Items',
    account: 'Accounts',
    journal: 'Journal Entries',
  }

  let runningIndex = -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" >
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search invoices, customers, items, accounts..."
            className="border-0 focus-visible:ring-0 text-base"
          />
          <kbd className="ml-2 shrink-0 rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {loading && (
            <div className="py-8 text-center text-sm text-muted-foreground">Searching...</div>
          )}

          {!loading && !query.trim() && (
            <div className="py-8 text-center">
              <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Start typing to search across all your data</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {['invoices', 'customers', 'suppliers', 'items', 'accounts'].map(t => (
                  <button
                    key={t}
                    onClick={() => setQuery(t)}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found for "{query}"
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-3">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="mb-1 px-2 text-xs font-semibold uppercase text-muted-foreground">
                    {typeLabels[type] || type}
                  </p>
                  {items.map((result) => {
                    runningIndex++
                    const idx = runningIndex
                    const Icon = ICONS[result.type] || FileText
                    return (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                          idx === selectedIndex ? "bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          idx === selectedIndex ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        </div>
                        {result.meta && (
                          <span className="shrink-0 text-xs text-muted-foreground">{result.meta}</span>
                        )}
                        <ArrowRight className={cn(
                          "h-4 w-4 shrink-0 transition-opacity",
                          idx === selectedIndex ? "opacity-100" : "opacity-0"
                        )} />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span><kbd className="rounded border bg-muted px-1">↑↓</kbd> Navigate</span>
            <span><kbd className="rounded border bg-muted px-1">↵</kbd> Select</span>
          </div>
          <span>{results.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
