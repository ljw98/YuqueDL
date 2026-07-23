import { pathToFileURL } from 'node:url'
import { readSettings } from '../../../utils/store'
import { resolveCoreEntry } from '../../../utils/paths'
import { assertRateLimit, clientKey } from '../../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  assertRateLimit(clientKey(event, 'token-check'), 6, 60_000)

  const body = await readBody<Record<string, any>>(event).catch(() => ({}))
  const settings = await readSettings()

  const inputToken = typeof body?.token === 'string' ? body.token.trim() : ''
  const token =
    inputToken && !inputToken.includes('****')
      ? inputToken
      : settings.token || ''
  const key =
    (typeof body?.key === 'string' && body.key.trim()) ||
    settings.key ||
    '_yuque_session'

  if (!token) {
    return {
      ok: false,
      code: 'missing_token',
      message: '未设置 Token，请先填写语雀 Token（或从浏览器复制 _yuque_session）',
    }
  }

  try {
    const coreEntry = await resolveCoreEntry()
    const core = await import(pathToFileURL(coreEntry).href)
    if (typeof core.getUserBooks !== 'function') {
      throw createError({
        statusCode: 500,
        statusMessage: '当前 core 未导出 getUserBooks，请先执行 pnpm run build:core',
      })
    }

    const books = await core.getUserBooks({ token, key })
    const list = Array.isArray(books) ? books : []
    const login = list[0]?.user?.login || ''

    return {
      ok: true,
      code: 'valid',
      message: login
        ? `Token 有效（${login}，可见 ${list.length} 个知识库）`
        : `Token 有效（可见 ${list.length} 个知识库）`,
      bookCount: list.length,
      login: login || undefined,
    }
  } catch (e: any) {
    const raw = String(e?.message || e?.statusMessage || e || '')
    const lower = raw.toLowerCase()
    if (
      lower.includes('401') ||
      lower.includes('403') ||
      lower.includes('unauthorized') ||
      lower.includes('login') ||
      lower.includes('cookie') ||
      lower.includes('token')
    ) {
      return {
        ok: false,
        code: 'invalid_token',
        message: 'Token 无效或已过期，请重新从浏览器复制 _yuque_session',
      }
    }
    if (lower.includes('network') || lower.includes('enotfound') || lower.includes('timeout')) {
      return {
        ok: false,
        code: 'network_error',
        message: '无法连接语雀，请检查网络后重试',
      }
    }
    return {
      ok: false,
      code: 'check_failed',
      message: raw.slice(0, 180) || '检测失败',
    }
  }
})
