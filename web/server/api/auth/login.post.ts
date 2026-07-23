import { setCookie } from 'h3'
import { readSettings } from '../../utils/store'
import { createSessionToken, getSessionCookieName, verifyPassword } from '../../utils/security'

const rateBucket = new Map<string, { count: number; resetAt: number }>()

function assertLoginRate(ip: string) {
  const now = Date.now()
  const windowMs = 60_000
  const max = 10
  const cur = rateBucket.get(ip)
  if (!cur || now > cur.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + windowMs })
    return
  }
  cur.count += 1
  if (cur.count > max) {
    throw createError({ statusCode: 429, statusMessage: '登录尝试过于频繁，请稍后再试' })
  }
}

export default defineEventHandler(async (event) => {
  // Do not trust X-Forwarded-For by default (easy to spoof without a trusted proxy).
  // Behind a reverse proxy, terminate TLS there and optionally set YUQUE_DL_TRUST_PROXY=1.
  const trustProxy = String(process.env.YUQUE_DL_TRUST_PROXY || '').trim() === '1'
  const ip =
    getRequestIP(event, { xForwardedFor: trustProxy }) ||
    event.node.req.socket?.remoteAddress ||
    'unknown'
  assertLoginRate(String(ip))

  const body = await readBody<{ password?: string }>(event)
  const password = String(body?.password || '')
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: '请输入密码' })
  }

  const config = useRuntimeConfig()
  const envPassword = String(config.accessPassword || process.env.YUQUE_DL_ACCESS_PASSWORD || '')
  const settings = await readSettings()
  const ok =
    (envPassword && password === envPassword) ||
    (await verifyPassword(password, settings.accessPasswordHash))

  if (!ok) {
    throw createError({ statusCode: 401, statusMessage: '访问密码错误' })
  }

  const token = await createSessionToken()
  // Local HTTP console must not mark cookie Secure, otherwise browsers/clients drop it.
  // If behind HTTPS reverse proxy, set YUQUE_DL_COOKIE_SECURE=1
  const secure = String(process.env.YUQUE_DL_COOKIE_SECURE || '').trim() === '1'
  setCookie(event, getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure,
  })

  return { ok: true }
})
