import { getCookie, getHeader } from 'h3'
import { readSettings } from './store'
import { getSessionCookieName, verifyApiToken, verifySessionToken } from './security'

export async function isAuthRequired() {
  const config = useRuntimeConfig()
  // Env password always enforces login (deployment-level override).
  if (String(config.accessPassword || process.env.YUQUE_DL_ACCESS_PASSWORD || '').trim()) {
    return true
  }
  const settings = await readSettings()
  // Switch off: keep password stored but do not require login.
  if (settings.accessAuthEnabled === false) {
    return false
  }
  return Boolean(settings.accessPasswordHash)
}

export async function isAuthenticated(event: any) {
  const token = getCookie(event, getSessionCookieName())
  return verifySessionToken(token)
}

export async function assertAuthenticated(event: any) {
  const required = await isAuthRequired()
  if (!required) return true
  const ok = await isAuthenticated(event)
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: '未登录或访问密码无效' })
  }
  return true
}

export function extractBearerToken(event: any): string {
  const auth = getHeader(event, 'authorization') || getHeader(event, 'Authorization') || ''
  const m = String(auth).match(/^Bearer\s+(.+)$/i)
  if (m?.[1]) return m[1].trim()
  // also allow x-api-token header for convenience
  const alt = getHeader(event, 'x-api-token') || ''
  return String(alt || '').trim()
}

export async function assertApiToken(event: any) {
  const token = extractBearerToken(event)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: '缺少 API Token（Authorization: Bearer <token>）' })
  }
  const settings = await readSettings()
  if (!settings.apiTokenHash) {
    throw createError({ statusCode: 401, statusMessage: '未配置 API Token，请先在控制台生成' })
  }
  const ok = await verifyApiToken(token, settings.apiTokenHash)
  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: 'API Token 无效' })
  }
  return true
}

/** Open API / MCP: require API token. Session alone is not enough. */
export async function assertOpenAccess(event: any) {
  return assertApiToken(event)
}
