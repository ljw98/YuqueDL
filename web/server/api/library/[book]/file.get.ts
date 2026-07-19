import { readBookFile } from '../../../utils/library'

export default defineEventHandler(async (event) => {
  const book = getRouterParam(event, 'book')
  const query = getQuery(event)
  const filePath = String(query.path || '')
  if (!book || !filePath) {
    throw createError({ statusCode: 400, statusMessage: 'missing book/path' })
  }
  return await readBookFile(decodeURIComponent(book), filePath)
})
