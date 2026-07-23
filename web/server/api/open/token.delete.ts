import { readSettings, writeSettings } from '../../utils/store'

/** Session-only: revoke API token */
export default defineEventHandler(async () => {
  const settings = await readSettings()
  const next = { ...settings }
  delete next.apiTokenHash
  delete next.apiTokenHint
  delete next.apiTokenCreatedAt
  await writeSettings(next)
  return { ok: true }
})
