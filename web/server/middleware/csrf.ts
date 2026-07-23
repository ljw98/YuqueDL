/**
 * Lightweight same-origin check for cookie-authenticated mutating requests.
 * SameSite=Lax already helps; this blocks obvious cross-site form posts.
 * Open API / MCP use Bearer tokens and skip this check.
 */
export default defineEventHandler((event) => {
  const method = (event.method || event.node.req.method || 'GET').toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return

  const path = getRequestURL(event).pathname || ''
  if (!path.startsWith('/api/')) return
  // login itself is intentionally open (rate-limited)
  if (path.startsWith('/api/auth/login')) return
  // token-authenticated open interfaces
  if (path === '/api/mcp' || path.startsWith('/api/mcp/') || path.startsWith('/api/open/')) return

  const host = getHeader(event, 'host') || ''
  const origin = getHeader(event, 'origin') || ''
  const referer = getHeader(event, 'referer') || ''

  // Non-browser clients often omit Origin/Referer; allow those.
  if (!origin && !referer) return

  const allowed = (value: string) => {
    try {
      const u = new URL(value)
      return u.host === host
    } catch {
      return false
    }
  }

  if (origin && !allowed(origin)) {
    throw createError({ statusCode: 403, statusMessage: '跨站请求已拒绝' })
  }
  if (!origin && referer && !allowed(referer)) {
    throw createError({ statusCode: 403, statusMessage: '跨站请求已拒绝' })
  }
})
