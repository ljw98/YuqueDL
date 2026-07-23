import { readSettings } from '../../utils/store'

/**
 * Session-only: status of API token (never returns full token).
 * Open routes themselves require Bearer token; this is for the console UI.
 */
export default defineEventHandler(async () => {
  const settings = await readSettings()
  return {
    configured: Boolean(settings.apiTokenHash),
    hint: settings.apiTokenHint || '',
    createdAt: settings.apiTokenCreatedAt || null,
  }
})
