import { listSchedules } from '../../utils/scheduler'

export default defineEventHandler(async () => {
  const schedules = await listSchedules()
  return { schedules }
})
