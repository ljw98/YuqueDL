import { getBookTree } from '../../../utils/library'

export default defineEventHandler(async (event) => {
  const book = getRouterParam(event, 'book')
  if (!book) throw createError({ statusCode: 400, statusMessage: 'missing book' })
  const query = getQuery(event)
  const dirPath = typeof query.path === 'string' ? query.path : ''
  return await getBookTree(decodeURIComponent(book), dirPath)
})
