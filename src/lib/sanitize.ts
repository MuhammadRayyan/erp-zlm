// ============================================================
// INPUT SANITIZATION — defensive helpers for cleaning user input
// before it touches the database or downstream services.
// ============================================================
// Use these on every API route that accepts user input. They are
// intentionally permissive: they coerce rather than reject, so
// callers should still perform schema validation (e.g. with zod)
// for business-rule checks.
// ============================================================

const MAX_STRING_LENGTH = 10_000
const MAX_EMAIL_LENGTH = 254 // RFC 5321
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const NULL_BYTE_RE = /\0/g
// Strip ASCII control chars except tab (\t), newline (\n), carriage return (\r)
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

/**
 * Trim, remove null bytes & dangerous control characters, and cap length.
 * Returns an empty string for null/undefined/non-string input.
 */
export function sanitizeString(str: unknown, maxLength = MAX_STRING_LENGTH): string {
  if (str === null || str === undefined) return ''
  if (typeof str !== 'string') {
    // Coerce numbers/booleans to a string — refuse objects/symbols
    if (typeof str === 'number' || typeof str === 'boolean') return String(str).slice(0, maxLength)
    return ''
  }
  let s = str.replace(NULL_BYTE_RE, '').replace(CONTROL_CHAR_RE, '')
  s = s.trim()
  if (s.length > maxLength) s = s.slice(0, maxLength)
  return s
}

/**
 * Lowercase, trim, validate email format. Returns the cleaned email
 * if valid, otherwise returns `null` so the caller can reject the
 * request with a 400.
 */
export function sanitizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const cleaned = email.trim().toLowerCase().replace(NULL_BYTE_RE, '').slice(0, MAX_EMAIL_LENGTH)
  if (!EMAIL_RE.test(cleaned)) return null
  return cleaned
}

/**
 * Parse any input to a finite number. Returns 0 for invalid input.
 * Negative zero is normalised to 0.
 */
export function sanitizeNumber(num: unknown): number {
  if (num === null || num === undefined || num === '') return 0
  if (typeof num === 'number') {
    return Number.isFinite(num) ? (Object.is(num, -0) ? 0 : num) : 0
  }
  if (typeof num === 'string') {
    // Strip whitespace and common thousands separators (commas)
    const cleaned = num.replace(/[, ]/g, '').trim()
    if (cleaned === '') return 0
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : 0
  }
  if (typeof num === 'boolean') return num ? 1 : 0
  return 0
}

/**
 * Sanitise every string value in a shallow object, leaving numbers,
 * booleans, arrays, and nested objects untouched. Useful for bulk-
// cleaning request bodies before schema validation.
 */
export function sanitizeStringFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[],
): T {
  const out = { ...obj }
  for (const f of fields) {
    if (typeof out[f] === 'string') {
      out[f] = sanitizeString(out[f]) as T[keyof T]
    }
  }
  return out
}
