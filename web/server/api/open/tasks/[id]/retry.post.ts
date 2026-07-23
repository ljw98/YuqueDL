import { retryTask } from '../../../../utils/store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })
  const task = await retryTask(id)
  return { task }
})
