import { maskToken, readSettings } from '../utils/store'

export default defineEventHandler(async () => {
  const settings = await readSettings()
  return {
    settings: {
      ...settings,
      token: settings.token ? maskToken(settings.token) : '',
      hasToken: Boolean(settings.token),
    },
  }
})
