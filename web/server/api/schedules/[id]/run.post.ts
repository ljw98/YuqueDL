import { runSchedule } from '../../../utils/scheduler'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })
  return await runSchedule(id, { manual: true })
})
