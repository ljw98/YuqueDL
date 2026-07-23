import { listTasks, loadJobsIntoMemory, publicTask } from '../../../utils/store'

export default defineEventHandler(async (event) => {
  await loadJobsIntoMemory()
  const query = getQuery(event)
  let tasks = listTasks().map(publicTask)
  const status = String(query.status || '').trim()
  if (status) {
    tasks = tasks.filter((t) => t.status === status)
  }
  const limit = Math.min(100, Math.max(1, Number(query.limit || 50) || 50))
  return { tasks: tasks.slice(0, limit) }
})
