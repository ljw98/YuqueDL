import { getBookTree } from '../../../utils/library'

export default defineEventHandler(async (event) => {
  const book = getRouterParam(event, 'book')
  if (!book) throw createError({ statusCode: 400, statusMessage: 'missing book' })
  return await getBookTree(decodeURIComponent(book))
})
