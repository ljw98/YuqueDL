import { isAuthRequired, isAuthenticated } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const required = await isAuthRequired()
  const authenticated = required ? await isAuthenticated(event) : true
  return {
    required,
    authenticated,
  }
})
