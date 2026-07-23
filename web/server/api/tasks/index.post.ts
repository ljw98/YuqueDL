import { createTask, type TaskType } from '../../utils/store'
import { assertRateLimit, clientKey } from '../../utils/rate-limit'

const ALLOWED_TYPES: TaskType[] = ['book', 'docs', 'batch', 'user']

export default defineEventHandler(async (event) => {
  // LAN stability: prevent create-task storms
  assertRateLimit(clientKey(event, 'create-task'), 10, 60_000)

  const body = await readBody<{
    type?: TaskType
    urls?: string[] | string
    options?: Record<string, any>
  }>(event)

  const type = (body?.type || 'book') as TaskType
  if (!ALLOWED_TYPES.includes(type)) {
    throw createError({ statusCode: 400, statusMessage: '无效的任务类型' })
  }

  let urls: string[] = []
  if (Array.isArray(body?.urls)) {
    urls = body.urls.map((s) => String(s || '').trim()).filter(Boolean)
  } else if (typeof body?.urls === 'string') {
    urls = body.urls
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  const task = await createTask({
    type,
    urls,
    options: body?.options || {},
  })
  return { task }
})
