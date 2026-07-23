import { listBooks } from '../../utils/library'
import { listTasks, loadJobsIntoMemory, publicTask, readSettings } from '../../utils/store'

export default defineEventHandler(async () => {
  await loadJobsIntoMemory()
  const settings = await readSettings()
  const tasks = listTasks().map(publicTask)
  const books = await listBooks()
  const running = tasks.filter((t) => t.status === 'running' || t.status === 'queued').length
  return {
    ok: true,
    service: 'yuque-dl',
    version: '1.0.0',
    maxConcurrency: Math.min(3, Math.max(1, Number(settings.maxConcurrency || 1))),
    stats: {
      tasks: tasks.length,
      running,
      books: books.length,
    },
  }
})
