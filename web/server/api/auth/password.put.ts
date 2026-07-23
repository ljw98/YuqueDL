import { readSettings, writeSettings } from '../../utils/store'
import { hashPassword, verifyPassword } from '../../utils/security'
import { assertAuthenticated, isAuthRequired } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ password?: string; oldPassword?: string; clear?: boolean }>(event)
  const settings = await readSettings()
  const required = await isAuthRequired()

  if (body?.clear) {
    if (required) await assertAuthenticated(event)
    const next = { ...settings }
    delete next.accessPasswordHash
    await writeSettings(next)
    return { ok: true, required: false }
  }

  const password = String(body?.password || '').trim()
  if (password.length < 4) {
    throw createError({ statusCode: 400, statusMessage: '访问密码至少 4 位' })
  }

  if (settings.accessPasswordHash) {
    const oldPassword = String(body?.oldPassword || '')
    const ok = await verifyPassword(oldPassword, settings.accessPasswordHash)
    if (!ok) {
      throw createError({ statusCode: 401, statusMessage: '原访问密码错误' })
    }
  }

  const next = {
    ...settings,
    accessPasswordHash: await hashPassword(password),
  }
  await writeSettings(next)
  return { ok: true, required: true }
})
