import { createTask, type TaskType } from '../../../utils/store'
import { assertRateLimit, clientKey } from '../../../utils/rate-limit'
import { sanitizeExternalTaskOptions } from '../../../utils/task-options'

const ALLOWED_TYPES: TaskType[] = ['book', 'docs', 'batch', 'user']

export default defineEventHandler(async (event) => {
  assertRateLimit(clientKey(event, 'open-create-task'), 10, 60_000)

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

  // strip session secrets only — keep book password; token always from settings
  const options = sanitizeExternalTaskOptions(body?.options)

  const task = await createTask({
    type,
    urls,
    options,
  })
  return { task }
})
