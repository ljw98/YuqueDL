export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return
  try {
    const status = await $fetch<{ required: boolean; authenticated: boolean }>('/api/auth/status')
    if (status.required && !status.authenticated) {
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  } catch {
    // if status endpoint fails, don't hard-block UI navigation
  }
})
