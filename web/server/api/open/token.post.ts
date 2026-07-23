import { generateApiToken, hashApiToken, maskApiToken } from '../../utils/security'
import { readSettings, writeSettings } from '../../utils/store'

/**
 * Session-only: generate/rotate API token.
 * Returns plaintext token ONCE.
 */
export default defineEventHandler(async () => {
  const settings = await readSettings()
  const token = generateApiToken()
  const hash = await hashApiToken(token)
  const next = {
    ...settings,
    apiTokenHash: hash,
    apiTokenHint: maskApiToken(token),
    apiTokenCreatedAt: Date.now(),
  }
  await writeSettings(next)
  return {
    ok: true,
    token,
    hint: next.apiTokenHint,
    createdAt: next.apiTokenCreatedAt,
    message: '请立即复制保存，关闭后无法再次查看完整 Token',
  }
})
