import { maskToken, readSettings, writeSettings } from '../utils/store'
import { hashPassword, verifyPassword } from '../utils/security'
import { normalizeIgnoreAttachments, publicIgnoreAttachments } from '../utils/settings-options'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, any>>(event)
  const current = await readSettings()
  const next = {
    ...current,
    key: body?.key !== undefined ? String(body.key || '') : current.key,
    ignoreImg: body?.ignoreImg ?? current.ignoreImg ?? false,
    ignoreAttachments:
      body?.ignoreAttachments !== undefined
        ? normalizeIgnoreAttachments(body.ignoreAttachments)
        : normalizeIgnoreAttachments(current.ignoreAttachments ?? false),
    toc: body?.toc ?? current.toc ?? false,
    incremental: body?.incremental ?? current.incremental ?? false,
    convertMarkdownVideoLinks:
      body?.convertMarkdownVideoLinks ?? current.convertMarkdownVideoLinks ?? false,
    hideFooter: body?.hideFooter ?? current.hideFooter ?? false,
    maxConcurrency: (() => {
      const n = Number(body?.maxConcurrency ?? current.maxConcurrency ?? 1)
      if (!Number.isFinite(n)) return 1
      return Math.min(3, Math.max(1, Math.floor(n)))
    })(),
    accessAuthEnabled:
      body?.accessAuthEnabled === undefined
        ? current.accessAuthEnabled !== false
        : Boolean(body.accessAuthEnabled),
  }

  // token：空字符串表示不改；明确 clearToken 才清空
  if (body?.clearToken) {
    delete next.token
  } else if (typeof body?.token === 'string' && body.token && !body.token.includes('****')) {
    next.token = body.token
  }

  // 访问密码：空表示不改；clearAccessPassword 清空；有值则更新
  if (body?.clearAccessPassword) {
    delete next.accessPasswordHash
  } else if (typeof body?.accessPassword === 'string' && body.accessPassword.trim()) {
    const pwd = body.accessPassword.trim()
    if (pwd.length < 4) {
      throw createError({ statusCode: 400, statusMessage: '访问密码至少 4 位' })
    }
    if (current.accessPasswordHash) {
      const oldPassword = String(body?.oldAccessPassword || '')
      const ok = await verifyPassword(oldPassword, current.accessPasswordHash)
      if (!ok) {
        throw createError({ statusCode: 401, statusMessage: '原访问密码错误' })
      }
    }
    next.accessPasswordHash = await hashPassword(pwd)
    // 设置密码时默认开启登录保护（除非本次明确关掉）
    if (body?.accessAuthEnabled === undefined) {
      next.accessAuthEnabled = true
    }
  }

  // 关闭登录保护时同步清除已保存的访问密码
  if (next.accessAuthEnabled === false) {
    delete next.accessPasswordHash
  }

  await writeSettings(next)
  return {
    ok: true,
    settings: {
      key: next.key || '',
      ignoreImg: Boolean(next.ignoreImg),
      ignoreAttachments: publicIgnoreAttachments(next.ignoreAttachments),
      toc: Boolean(next.toc),
      incremental: Boolean(next.incremental),
      convertMarkdownVideoLinks: Boolean(next.convertMarkdownVideoLinks),
      hideFooter: Boolean(next.hideFooter),
      maxConcurrency: next.maxConcurrency || 1,
      token: next.token ? maskToken(next.token) : '',
      hasToken: Boolean(next.token),
      hasAccessPassword: Boolean(next.accessPasswordHash),
      accessAuthEnabled: next.accessAuthEnabled !== false,
    },
  }
})
