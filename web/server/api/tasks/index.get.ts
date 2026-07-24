import { listTasks, loadJobsIntoMemory, publicTask } from '../../utils/store'

function parseBool(v: unknown) {
  if (v === true || v === 1) return true
  const s = String(v ?? '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

/**
 * GET /api/tasks
 * - 默认 lite：不含 logs（仅 logCount）
 * - includeLogs=1 返回完整 logs
 * - status=running,queued 可过滤（逗号分隔）
 */
export default defineEventHandler(async (event) => {
  await loadJobsIntoMemory()
  const query = getQuery(event)
  const includeLogs = parseBool(query.includeLogs)
  const statusRaw = String(query.status || '').trim()
  const statuses = statusRaw
    ? statusRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  let tasks = listTasks().map((t) => publicTask(t, { includeLogs }))
  if (statuses.length) {
    tasks = tasks.filter((t) => statuses.includes(String(t.status)))
  }
  return { tasks }
})
