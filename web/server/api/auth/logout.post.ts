import { deleteCookie } from 'h3'
import { getSessionCookieName } from '../../utils/security'

export default defineEventHandler(async (event) => {
  deleteCookie(event, getSessionCookieName(), { path: '/' })
  return { ok: true }
})
