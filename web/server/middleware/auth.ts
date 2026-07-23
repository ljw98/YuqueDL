import { assertAuthenticated, assertOpenAccess } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname || ''
  if (!path.startsWith('/api/')) return
  if (path.startsWith('/api/auth/')) return

  // Token management is console-only (session cookie), not Bearer API token
  if (
    path === '/api/open/token' ||
    path.startsWith('/api/open/token/')
  ) {
    await assertAuthenticated(event)
    return
  }

  // Open API + MCP: Bearer API Token only
  if (path === '/api/mcp' || path.startsWith('/api/mcp/') || path.startsWith('/api/open/')) {
    await assertOpenAccess(event)
    return
  }

  await assertAuthenticated(event)
})
