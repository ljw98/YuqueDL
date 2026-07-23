import { maskToken, readSettings } from '../utils/store'
import { publicIgnoreAttachments } from '../utils/settings-options'

export default defineEventHandler(async () => {
  const settings = await readSettings()
  return {
    settings: {
      key: settings.key || '',
      ignoreImg: Boolean(settings.ignoreImg),
      ignoreAttachments: publicIgnoreAttachments(settings.ignoreAttachments),
      toc: Boolean(settings.toc),
      incremental: Boolean(settings.incremental),
      convertMarkdownVideoLinks: Boolean(settings.convertMarkdownVideoLinks),
      hideFooter: Boolean(settings.hideFooter),
      maxConcurrency: Math.min(3, Math.max(1, Number(settings.maxConcurrency || 1))),
      token: settings.token ? maskToken(settings.token) : '',
      hasToken: Boolean(settings.token),
      hasAccessPassword: Boolean(settings.accessPasswordHash),
      accessAuthEnabled: settings.accessAuthEnabled !== false,
    },
  }
})
