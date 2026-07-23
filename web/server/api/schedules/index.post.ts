import { createSchedule, isValidInterval } from '../../utils/scheduler'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, any>>(event)
  const schedule = await createSchedule({
    url: String(body?.url || ''),
    interval: isValidInterval(body?.interval) ? body.interval : 'daily',
    enabled: body?.enabled !== false,
  })
  return { ok: true, schedule }
})
