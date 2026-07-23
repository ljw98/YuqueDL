import { startScheduler } from '../utils/scheduler'

export default defineNitroPlugin(() => {
  startScheduler()
})
