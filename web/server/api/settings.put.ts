import { readSettings, writeSettings } from '../utils/store'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, any>>(event)
  const current = await readSettings()
  const next = {
    ...current,
    key: body?.key !== undefined ? String(body.key || '') : current.key,
    ignoreImg: body?.ignoreImg ?? current.ignoreImg ?? false,
    ignoreAttachments: body?.ignoreAttachments ?? current.ignoreAttachments ?? false,
    toc: body?.toc ?? current.toc ?? false,
    incremental: body?.incremental ?? current.incremental ?? false,
    convertMarkdownVideoLinks:
      body?.convertMarkdownVideoLinks ?? current.convertMarkdownVideoLinks ?? false,
    hideFooter: body?.hideFooter ?? current.hideFooter ?? false,
  }

  // token：空字符串表示不改；明确 clearToken 才清空
  if (body?.clearToken) {
    delete next.token
  } else if (typeof body?.token === 'string' && body.token && !body.token.includes('****')) {
    next.token = body.token
  }

  await writeSettings(next)
  return {
    ok: true,
    settings: {
      ...next,
      token: next.token ? `${String(next.token).slice(0, 4)}****` : '',
      hasToken: Boolean(next.token),
    },
  }
})
