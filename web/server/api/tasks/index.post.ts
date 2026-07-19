import { createTask, type TaskType } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    type?: TaskType
    urls?: string[] | string
    options?: Record<string, any>
  }>(event)

  const type = body?.type || 'book'
  let urls: string[] = []
  if (Array.isArray(body?.urls)) {
    urls = body.urls
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
