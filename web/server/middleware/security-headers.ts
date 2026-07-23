/**
 * Baseline security headers. Safe for LAN HTTP; does not force HTTPS.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname || ''
  // skip static assets noise is fine; headers still ok everywhere
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'X-DNS-Prefetch-Control', 'off')
  // Only enable a mild CSP on API JSON responses would break the SPA.
  // Keep CSP off for HTML app; optional Permissions-Policy.
  if (path.startsWith('/api/')) {
    setHeader(event, 'Cache-Control', 'no-store')
  }
})
