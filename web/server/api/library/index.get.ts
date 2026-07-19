import { listBooks } from '../../utils/library'

export default defineEventHandler(async () => {
  const books = await listBooks()
  return { books }
})
