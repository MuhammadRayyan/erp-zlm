// ============================================================
// RATE LIMITER — simple in-memory, per-key limiter.
// ============================================================
// ⚠️ WARNING: This rate limiter is in-memory and NOT safe for
// multi-instance deployments (Docker replicas, serverless).
// For horizontal scaling, replace with a Redis-backed limiter:
// https://github.com/upstash/ratelimit
// ============================================================

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  if (!key) return true
  const now = Date.now()

  // Lazy sweep — evict expired buckets
  if (now % 100 === 0) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k)
    }
  }

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (existing.count >= maxRequests) {
    return false
  }

  existing.count += 1
  return true
}

export function retryAfterSeconds(key: string): number {
  const b = buckets.get(key)
  if (!b) return 0
  const ms = b.resetAt - Date.now()
  return ms > 0 ? Math.ceil(ms / 1000) : 0
}

// 10 attempts per 15 minutes in production, 50 per 5 min in development
export function checkLoginRateLimit(ip: string): boolean {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return rateLimit(`login:${ip}`, 500, 5 * 60 * 1000)
  }
  return rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
}

// 5 attempts per hour in production, 20 per 5 min in development
export function checkRegisterRateLimit(ip: string): boolean {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return rateLimit(`register:${ip}`, 200, 5 * 60 * 1000)
  }
  return rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
}

export function resetRateLimits() {
  buckets.clear()
}
