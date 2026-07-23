import { isValidInterval, updateSchedule } from '../../utils/scheduler'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })
  const body = await readBody<Record<string, any>>(event)
  const patch: Record<string, any> = {}
  if (body?.url !== undefined) patch.url = body.url
  if (body?.interval !== undefined) {
    if (!isValidInterval(body.interval)) {
      throw createError({ statusCode: 400, statusMessage: '无效的同步周期' })
    }
    patch.interval = body.interval
  }
  if (body?.enabled !== undefined) patch.enabled = Boolean(body.enabled)
  const schedule = await updateSchedule(id, patch)
  return { ok: true, schedule }
})
