import { getTask, loadJobsIntoMemory, publicTask, subscribeTask } from '../../../utils/store'

export default defineEventHandler(async (event) => {
  await loadJobsIntoMemory()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })
  const task = getTask(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  setHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setHeader(event, 'Connection', 'keep-alive')
  setHeader(event, 'X-Accel-Buffering', 'no')

  const res = event.node.res
  const send = (payload: any) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  send({ type: 'task', task: publicTask(task) })
  for (const log of task.logs.slice(-50)) {
    send({ type: 'log', log })
  }
  send({
    type: 'progress',
    current: task.current,
    total: task.total,
    message: task.message,
  })

  const unsub = subscribeTask(id, send)
  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`)
  }, 15000)

  const close = () => {
    clearInterval(heartbeat)
    unsub()
  }

  event.node.req.on('close', close)
  event.node.req.on('error', close)

  await new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
  })
})
