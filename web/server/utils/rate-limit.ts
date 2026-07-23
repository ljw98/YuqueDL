/**
 * Lightweight in-process rate limiter (per-key sliding fixed window).
 * Intended for LAN stability (misclick / script storms), not hard security.
 */

type Bucket = { count: number; resetAt: number }

const g = globalThis as typeof globalThis & {
  __yuqueRateBuckets?: Map<string, Bucket>
}

function buckets() {
  if (!g.__yuqueRateBuckets) g.__yuqueRateBuckets = new Map()
  return g.__yuqueRateBuckets
}

export function clientKey(event: any, prefix: string) {
  // Align with login rate-limit: only trust XFF when YUQUE_DL_TRUST_PROXY=1
  const trustProxy = String(process.env.YUQUE_DL_TRUST_PROXY || '').trim() === '1'
  const ip =
    getRequestIP(event, { xForwardedFor: trustProxy }) ||
    event?.node?.req?.socket?.remoteAddress ||
    'local'
  return `${prefix}:${String(ip)}`
}

/**
 * Throws 429 when over limit.
 * @param key unique bucket key (include action + ip)
 * @param max max requests in window
 * @param windowMs window length
 */
export function assertRateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const map = buckets()
  let cur = map.get(key)
  if (!cur || now > cur.resetAt) {
    cur = { count: 1, resetAt: now + windowMs }
    map.set(key, cur)
    return
  }
  cur.count += 1
  if (cur.count > max) {
    const waitSec = Math.max(1, Math.ceil((cur.resetAt - now) / 1000))
    throw createError({
      statusCode: 429,
      statusMessage: `操作过于频繁，请 ${waitSec} 秒后再试`,
    })
  }
}

/** Global single-flight style concurrency gate (e.g. export). */
export function createConcurrencyGate(name: string, max = 1) {
  const g2 = globalThis as typeof globalThis & {
    __yuqueGates?: Map<string, number>
  }
  if (!g2.__yuqueGates) g2.__yuqueGates = new Map()

  function active() {
    return g2.__yuqueGates!.get(name) || 0
  }

  function tryEnter(message = '已有相同操作进行中，请稍后再试') {
    const n = active()
    if (n >= max) {
      throw createError({ statusCode: 429, statusMessage: message })
    }
    g2.__yuqueGates!.set(name, n + 1)
  }

  function leave() {
    const n = active()
    g2.__yuqueGates!.set(name, Math.max(0, n - 1))
  }

  return { tryEnter, leave, active }
}
