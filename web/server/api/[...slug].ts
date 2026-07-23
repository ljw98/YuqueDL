export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname || ''
  throw createError({
    statusCode: 404,
    statusMessage: `API not found: ${path}`,
  })
})
