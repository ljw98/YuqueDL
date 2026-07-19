import { listTasks, loadJobsIntoMemory, publicTask } from '../../utils/store'

export default defineEventHandler(async () => {
  await loadJobsIntoMemory()
  return {
    tasks: listTasks().map(publicTask),
  }
})
