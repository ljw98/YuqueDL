import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { ensureDataDirs, getDataPaths } from './paths'

export type TaskType = 'book' | 'docs' | 'batch' | 'user'
export type TaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

export interface TaskOptions {
  ignoreImg?: boolean
  ignoreAttachments?: boolean | string
  token?: string
  key?: string
  password?: string
  toc?: boolean
  incremental?: boolean
  convertMarkdownVideoLinks?: boolean
  hideFooter?: boolean
}

export interface TaskLog {
  ts: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export interface TaskRecord {
  id: string
  type: TaskType
  urls: string[]
  options: TaskOptions
  status: TaskStatus
  createdAt: number
  startedAt?: number
  finishedAt?: number
  current: number
  total: number
  message?: string
  error?: string
  bookPath?: string
  bookName?: string
  logs: TaskLog[]
}

export interface AppSettings {
  token?: string
  key?: string
  ignoreImg?: boolean
  ignoreAttachments?: boolean
  toc?: boolean
  incremental?: boolean
  convertMarkdownVideoLinks?: boolean
  hideFooter?: boolean
}

interface JobsFile {
  tasks: TaskRecord[]
}

const g = globalThis as typeof globalThis & {
  __yuqueJobs?: Map<string, TaskRecord>
  __yuqueControllers?: Map<string, AbortController>
  __yuqueQueue?: string[]
  __yuqueRunning?: boolean
  __yuqueSse?: Map<string, Set<(payload: any) => void>>
}

function state() {
  if (!g.__yuqueJobs) g.__yuqueJobs = new Map()
  if (!g.__yuqueControllers) g.__yuqueControllers = new Map()
  if (!g.__yuqueQueue) g.__yuqueQueue = []
  if (!g.__yuqueSse) g.__yuqueSse = new Map()
  if (g.__yuqueRunning == null) g.__yuqueRunning = false
  return {
    jobs: g.__yuqueJobs,
    controllers: g.__yuqueControllers,
    queue: g.__yuqueQueue,
    sse: g.__yuqueSse,
    get running() {
      return Boolean(g.__yuqueRunning)
    },
    set running(v: boolean) {
      g.__yuqueRunning = v
    },
  }
}

async function readJobsFile(): Promise<JobsFile> {
  const { jobsFile } = getDataPaths()
  try {
    const raw = await readFile(jobsFile, 'utf8')
    return JSON.parse(raw) as JobsFile
  } catch {
    return { tasks: [] }
  }
}

export async function persistJobs() {
  await ensureDataDirs()
  const { jobsFile } = getDataPaths()
  const { jobs } = state()
  const tasks = [...jobs.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((t) => ({
      ...t,
      logs: t.logs.slice(-200),
    }))
  await writeFile(jobsFile, JSON.stringify({ tasks }, null, 2), 'utf8')
}

export async function loadJobsIntoMemory() {
  const { jobs } = state()
  if (jobs.size > 0) return
  const data = await readJobsFile()
  for (const task of data.tasks || []) {
    if (task.status === 'running' || task.status === 'queued') {
      task.status = 'failed'
      task.error = task.error || '服务重启，任务中断'
      task.finishedAt = Date.now()
      task.logs = task.logs || []
      task.logs.push({
        ts: Date.now(),
        level: 'warn',
        message: '服务重启，任务中断',
      })
    }
    jobs.set(task.id, task)
  }
}

export async function readSettings(): Promise<AppSettings> {
  await ensureDataDirs()
  const { settingsFile } = getDataPaths()
  try {
    const raw = await readFile(settingsFile, 'utf8')
    return JSON.parse(raw) as AppSettings
  } catch {
    return {}
  }
}

export async function writeSettings(settings: AppSettings) {
  await ensureDataDirs()
  const { settingsFile } = getDataPaths()
  await writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf8')
  return settings
}

export function maskToken(token?: string) {
  if (!token) return ''
  if (token.length <= 8) return '********'
  return `${token.slice(0, 4)}****${token.slice(-4)}`
}

export function listTasks() {
  const { jobs } = state()
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt)
}

export function getTask(id: string) {
  return state().jobs.get(id)
}

export function publicTask(task: TaskRecord) {
  return {
    ...task,
    options: {
      ...task.options,
      token: task.options.token ? maskToken(task.options.token) : '',
      password: task.options.password ? '******' : '',
    },
  }
}

export async function createTask(input: {
  type: TaskType
  urls?: string[]
  options?: TaskOptions
}) {
  await loadJobsIntoMemory()
  const settings = await readSettings()
  const id = randomUUID()
  const options: TaskOptions = {
    ignoreImg: input.options?.ignoreImg ?? settings.ignoreImg ?? false,
    ignoreAttachments: input.options?.ignoreAttachments ?? settings.ignoreAttachments ?? false,
    token: input.options?.token ?? settings.token,
    key: input.options?.key ?? settings.key,
    password: input.options?.password,
    toc: input.options?.toc ?? settings.toc ?? false,
    incremental: input.options?.incremental ?? settings.incremental ?? false,
    convertMarkdownVideoLinks:
      input.options?.convertMarkdownVideoLinks ?? settings.convertMarkdownVideoLinks ?? false,
    hideFooter: input.options?.hideFooter ?? settings.hideFooter ?? false,
  }

  const task: TaskRecord = {
    id,
    type: input.type,
    urls: (input.urls || []).map((u) => u.trim()).filter(Boolean),
    options,
    status: 'queued',
    createdAt: Date.now(),
    current: 0,
    total: 0,
    logs: [{ ts: Date.now(), level: 'info', message: '任务已创建，等待执行' }],
  }

  if (task.type !== 'user' && task.urls.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '请至少提供一个 URL' })
  }
  if (task.type === 'user' && !task.options.token) {
    throw createError({ statusCode: 400, statusMessage: '下载全部知识库需要 token' })
  }

  const { jobs, queue } = state()
  jobs.set(id, task)
  queue.push(id)
  await persistJobs()
  emitTask(id, { type: 'task', task: publicTask(task) })
  void pumpQueue()
  return publicTask(task)
}

export function subscribeTask(id: string, fn: (payload: any) => void) {
  const { sse } = state()
  if (!sse.has(id)) sse.set(id, new Set())
  sse.get(id)!.add(fn)
  return () => {
    sse.get(id)?.delete(fn)
  }
}

export function emitTask(id: string, payload: any) {
  const { sse } = state()
  const set = sse.get(id)
  if (!set) return
  for (const fn of set) {
    try {
      fn(payload)
    } catch {
      // ignore
    }
  }
}

export function appendLog(task: TaskRecord, level: TaskLog['level'], message: string) {
  const log = { ts: Date.now(), level, message }
  task.logs.push(log)
  if (task.logs.length > 500) task.logs = task.logs.slice(-500)
  emitTask(task.id, { type: 'log', log })
}

export async function cancelTask(id: string) {
  await loadJobsIntoMemory()
  const { jobs, controllers, queue } = state()
  const task = jobs.get(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  if (task.status === 'queued') {
    const idx = queue.indexOf(id)
    if (idx >= 0) queue.splice(idx, 1)
    task.status = 'cancelled'
    task.finishedAt = Date.now()
    task.message = '已取消'
    appendLog(task, 'warn', '任务已取消')
    await persistJobs()
    emitTask(id, { type: 'task', task: publicTask(task) })
    return publicTask(task)
  }

  if (task.status === 'running') {
    controllers.get(id)?.abort()
    appendLog(task, 'warn', '正在取消任务…')
    emitTask(id, { type: 'task', task: publicTask(task) })
    return publicTask(task)
  }

  return publicTask(task)
}

export async function retryTask(id: string) {
  await loadJobsIntoMemory()
  const { jobs, queue } = state()
  const task = jobs.get(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  if (task.status !== 'failed' && task.status !== 'cancelled') {
    throw createError({ statusCode: 400, statusMessage: '只有失败或已取消的任务可以重试' })
  }

  // 重置任务状态
  task.status = 'queued'
  task.startedAt = undefined
  task.finishedAt = undefined
  task.current = 0
  task.total = 0
  task.error = undefined
  task.message = '等待重试'
  task.logs.push({ ts: Date.now(), level: 'info', message: '任务已重置，等待重试' })

  queue.push(id)
  await persistJobs()
  emitTask(id, { type: 'task', task: publicTask(task) })
  void pumpQueue()
  return publicTask(task)
}

async function pumpQueue() {
  const s = state()
  if (s.running) return
  const nextId = s.queue.shift()
  if (!nextId) return
  s.running = true
  try {
    await runTask(nextId)
  } finally {
    s.running = false
    if (s.queue.length > 0) void pumpQueue()
  }
}

async function runTask(id: string) {
  const { jobs, controllers } = state()
  const task = jobs.get(id)
  if (!task) return

  const controller = new AbortController()
  controllers.set(id, controller)
  task.status = 'running'
  task.startedAt = Date.now()
  task.message = '下载中'
  appendLog(task, 'info', '开始执行任务')
  emitTask(id, { type: 'task', task: publicTask(task) })
  await persistJobs()

  try {
    const { downloadsDir } = getDataPaths()
    const { resolve } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const rootDir = resolve(fileURLToPath(import.meta.url), '../../../..')
    const core = await import(resolve(rootDir, 'dist/es/index.js'))

    const options = {
      distDir: downloadsDir,
      ignoreImg: Boolean(task.options.ignoreImg),
      ignoreAttachments: task.options.ignoreAttachments ?? false,
      token: task.options.token,
      key: task.options.key,
      password: task.options.password,
      toc: Boolean(task.options.toc),
      incremental: Boolean(task.options.incremental),
      convertMarkdownVideoLinks: Boolean(task.options.convertMarkdownVideoLinks),
      hideFooter: Boolean(task.options.hideFooter),
    }

    const hooks = {
      signal: controller.signal,
      onLog: (level: TaskLog['level'], message: string) => {
        appendLog(task, level, message)
      },
      onProgress: (payload: {
        current: number
        total: number
        message?: string
        phase?: string
      }) => {
        task.current = payload.current
        task.total = payload.total
        if (payload.message) task.message = payload.message
        emitTask(id, {
          type: 'progress',
          current: task.current,
          total: task.total,
          message: task.message,
          phase: payload.phase,
        })
      },
    }

    let result: any
    if (task.type === 'book') {
      result = await core.main(task.urls[0], options, hooks)
    } else if (task.type === 'docs') {
      result = await core.downloadDocsFromUrls(task.urls, options)
    } else if (task.type === 'batch') {
      // batch 暂复用 main 逐个跑，便于进度钩子
      for (const url of task.urls) {
        if (controller.signal.aborted) throw new Error('Download aborted')
        appendLog(task, 'info', `开始下载知识库: ${url}`)
        result = await core.main(url, options, hooks)
      }
    } else if (task.type === 'user') {
      result = await core.downloadUserBooks(options)
    }

    if (controller.signal.aborted) {
      task.status = 'cancelled'
      task.error = '已取消'
      task.message = '已取消'
      appendLog(task, 'warn', '任务已取消')
    } else {
      task.status = 'success'
      task.message = '下载完成'
      if (result?.bookPath) task.bookPath = result.bookPath
      if (result?.bookName) task.bookName = result.bookName
      appendLog(task, 'info', '任务完成')
    }
  } catch (err: any) {
    if (controller.signal.aborted || /abort/i.test(String(err?.message || ''))) {
      task.status = 'cancelled'
      task.error = '已取消'
      task.message = '已取消'
      appendLog(task, 'warn', '任务已取消')
    } else {
      task.status = 'failed'
      task.error = err?.message || String(err)
      task.message = task.error
      appendLog(task, 'error', task.error || '未知错误')
    }
  } finally {
    task.finishedAt = Date.now()
    controllers.delete(id)
    emitTask(id, { type: 'task', task: publicTask(task) })
    emitTask(id, { type: 'done', task: publicTask(task) })
    await persistJobs()
  }
}
