import { getTask, loadJobsIntoMemory, publicTask } from '../../../utils/store'

export default defineEventHandler(async (event) => {
  await loadJobsIntoMemory()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })
  const task = getTask(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })
  return { task: publicTask(task, { includeLogs: true }) }
})
