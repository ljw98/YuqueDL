/**
 * Strip stack traces from API JSON errors outside development.
 * Dev keeps stacks for debugging; production/LAN preview avoids leaking paths.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error: any) => {
    if (process.env.NODE_ENV === 'development') return
    if (error && typeof error === 'object') {
      try {
        delete error.stack
      } catch {
        // ignore
      }
    }
  })
})
