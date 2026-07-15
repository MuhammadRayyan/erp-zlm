'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fmtDate } from './ui-helpers'
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Ban,
  Banknote,
  BookOpen,
  FileText,
  RefreshCw,
  Activity,
} from 'lucide-react'

interface ActivityEntry {
  id: string
  userId: string
  userName: string
  userEmail: string
  entityType: string
  entityId: string
  action: string
  message: string
  metadata: string | null
  createdAt: string
}

interface ActivityTimelineProps {
  entityType: string
  entityId: string
  /** Optional title override (default: "Activity") */
  title?: string
  /** Optional max entries to show (default: 50) */
  limit?: number
}

// Icon + color per action verb
const ACTION_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  CREATED: { icon: Plus, color: 'bg-emerald-500' },
  UPDATED: { icon: Pencil, color: 'bg-blue-500' },
  DELETED: { icon: Trash2, color: 'bg-red-500' },
  POSTED: { icon: Send, color: 'bg-purple-500' },
  VOIDED: { icon: Ban, color: 'bg-amber-500' },
  PAID: { icon: Banknote, color: 'bg-emerald-600' },
  EMAILED: { icon: Send, color: 'bg-cyan-500' },
  PRINTED: { icon: FileText, color: 'bg-slate-500' },
  COMMENTED: { icon: FileText, color: 'bg-gray-500' },
  ARCHIVED: { icon: Ban, color: 'bg-gray-500' },
  RESTORED: { icon: RefreshCw, color: 'bg-emerald-500' },
}

function getActionStyle(action: string) {
  return ACTION_STYLES[action] || { icon: Activity, color: 'bg-slate-400' }
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return fmtDate(iso)
}

export function ActivityTimeline({ entityType, entityId, title = 'Activity', limit = 50 }: ActivityTimelineProps) {
  const [activities, setActivities] = React.useState<ActivityEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [nonce, setNonce] = React.useState(0)

  const refetch = React.useCallback(() => setNonce(n => n + 1), [])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    const url = `/api/activity?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}&limit=${limit}`
    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (Array.isArray(d)) {
          setActivities(d)
          setError(null)
        } else {
          setError(d.error || 'Failed to load activity')
        }
      })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [entityType, entityId, limit, nonce])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <button
          onClick={refetch}
          className="text-xs text-muted-foreground hover:text-foreground"
          aria-label="Refresh activity"
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Loading activity...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-red-600">{error}</div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</div>
        ) : (
          <ol className="relative">
            {/* vertical line */}
            <div className="absolute bottom-2 left-[15px] top-2 w-px bg-border" aria-hidden />
            {activities.map(a => {
              const { icon: Icon, color } = getActionStyle(a.action)
              return (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className={cn('z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white ring-4 ring-background', color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{a.userName}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">{a.action}</Badge>
                      <span className="text-xs text-muted-foreground" title={fmtDate(a.createdAt)}>
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.message}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
