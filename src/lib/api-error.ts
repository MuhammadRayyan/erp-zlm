import { NextResponse } from 'next/server'

export function apiError(e: unknown, status = 400) {
  const isDev = process.env.NODE_ENV !== 'production'
  const message = isDev
    ? (e instanceof Error ? e.message : String(e))
    : 'An error occurred. Please try again.'
  console.error('[API Error]', e)
  return NextResponse.json({ error: message }, { status })
}
