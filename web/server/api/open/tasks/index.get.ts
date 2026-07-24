import { listTasks, loadJobsIntoMemory, publicTask } from '../../../utils/store'

function parseBool(v: unknown) {
  if (v === true || v === 1) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

export default defineEventHandler(async (event) => {
  await loadJobsIntoMemory()
  const query = getQuery(event)
  const includeLogs = parseBool(query.includeLogs)
  let tasks = listTasks().map((t) => publicTask(t, { includeLogs }))
  const status = String(query.status || '').trim()
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
    if (statuses.length === 1) {
      tasks = tasks.filter((t) => t.status === statuses[0])
    } else if (statuses.length > 1) {
      tasks = tasks.filter((t) => statuses.includes(String(t.status)))
    }
  }
  const limit = Math.min(100, Math.max(1, Number(query.limit || 50) || 50))
  return { tasks: tasks.slice(0, limit) }
})
