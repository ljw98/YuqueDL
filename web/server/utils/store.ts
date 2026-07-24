import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { ensureDataDirs, getDataPaths } from './paths'
import { decryptSecret, encryptSecret, secureWriteJson } from './security'
import { normalizeIgnoreAttachments } from './settings-options'
import { classifyTaskError } from './errors'

export type TaskType = 'book' | 'docs' | 'batch' | 'user'
export type TaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled'
/** manual = 控制台/Open/MCP；schedule = 定时同步；retry = 失败重试 */
export type TaskSource = 'manual' | 'schedule' | 'retry'

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
  /** 任务关联的知识库名（用于删除冲突检测等） */
  targetBooks?: string[]
  /** 任务来源 */
  source?: TaskSource
  /** 来自哪条定时规则（source=schedule 时） */
  scheduleId?: string
  logs: TaskLog[]
}

export interface AppSettings {
  token?: string
  key?: string
  ignoreImg?: boolean
  /** false=下载附件；true=忽略全部；string=仅忽略后缀，如 "mp4,pdf" */
  ignoreAttachments?: boolean | string
  toc?: boolean
  incremental?: boolean
  convertMarkdownVideoLinks?: boolean
  hideFooter?: boolean
  /** scrypt hash of web access password */
  accessPasswordHash?: string
  /**
   * Whether console login protection is enabled.
   * When false, password may still be stored but login is not required.
   * Default true when unset.
   */
  accessAuthEnabled?: boolean
  /** max concurrent download tasks, default 1, clamp 1..3 */
  maxConcurrency?: number
  /** scrypt hash of API token for open API / MCP */
  apiTokenHash?: string
  /** token prefix for display, e.g. ydl_xxxx */
  apiTokenHint?: string
  /** when the API token was created */
  apiTokenCreatedAt?: number
}

interface JobsFile {
  tasks: TaskRecord[]
}

const g = globalThis as typeof globalThis & {
  __yuqueJobs?: Map<string, TaskRecord>
  __yuqueControllers?: Map<string, AbortController>
  __yuqueQueue?: string[]
  __yuqueActive?: Set<string>
  __yuqueSse?: Map<string, Set<(payload: any) => void>>
  __yuqueMaxConcurrency?: number
}

function clampConcurrency(n: unknown) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 1
  return Math.min(3, Math.max(1, Math.floor(v)))
}

function state() {
  if (!g.__yuqueJobs) g.__yuqueJobs = new Map()
  if (!g.__yuqueControllers) g.__yuqueControllers = new Map()
  if (!g.__yuqueQueue) g.__yuqueQueue = []
  if (!g.__yuqueSse) g.__yuqueSse = new Map()
  if (!g.__yuqueActive) g.__yuqueActive = new Set()
  if (g.__yuqueMaxConcurrency == null) g.__yuqueMaxConcurrency = 1
  return {
    jobs: g.__yuqueJobs,
    controllers: g.__yuqueControllers,
    queue: g.__yuqueQueue,
    sse: g.__yuqueSse,
    active: g.__yuqueActive,
    get maxConcurrency() {
      return clampConcurrency(g.__yuqueMaxConcurrency)
    },
    set maxConcurrency(v: number) {
      g.__yuqueMaxConcurrency = clampConcurrency(v)
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

/** Finished task retention. Override via env. */
function retentionConfig() {
  const maxTasks = Math.max(20, Number(process.env.YUQUE_DL_JOBS_MAX || 200) || 200)
  const keepDays = Math.max(1, Number(process.env.YUQUE_DL_JOBS_KEEP_DAYS || 30) || 30)
  const logLimitActive = 200
  const logLimitDone = 80
  return { maxTasks, keepDays, logLimitActive, logLimitDone }
}

/**
 * Drop old finished tasks to keep jobs.json small.
 * Never deletes queued/running.
 */
export function pruneJobsInMemory() {
  const { jobs } = state()
  const { maxTasks, keepDays } = retentionConfig()
  const now = Date.now()
  const keepMs = keepDays * 24 * 60 * 60 * 1000
  const active = new Set(['queued', 'running'])

  for (const [id, t] of [...jobs.entries()]) {
    if (active.has(t.status)) continue
    const end = Number(t.finishedAt || t.createdAt || 0)
    if (end && now - end > keepMs) {
      jobs.delete(id)
    }
  }

  // cap total count: drop oldest finished first
  let list = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt)
  if (list.length > maxTasks) {
    const victims = list
      .filter((t) => !active.has(t.status))
      .sort((a, b) => a.createdAt - b.createdAt)
    let over = list.length - maxTasks
    for (const t of victims) {
      if (over <= 0) break
      jobs.delete(t.id)
      over -= 1
    }
  }
}

export async function persistJobs() {
  await ensureDataDirs()
  const { jobsFile } = getDataPaths()
  const { jobs } = state()
  pruneJobsInMemory()
  const { logLimitActive, logLimitDone } = retentionConfig()
  const tasks = []
  for (const t of [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt)) {
    const options = { ...t.options }
    if (options.token) options.token = await encryptSecret(options.token)
    if (options.password) options.password = await encryptSecret(options.password)
    const logLimit =
      t.status === 'queued' || t.status === 'running' ? logLimitActive : logLimitDone
    tasks.push({
      ...t,
      options,
      logs: t.logs.slice(-logLimit),
    })
  }
  await secureWriteJson(jobsFile, { tasks })
}

function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function loadJobsIntoMemory() {
  const s = state()
  if (s.jobs.size > 0) return
  // 单实例提醒：任务队列在进程内存中，多实例部署可能重复执行
  try {
    const { writeFile, readFile } = await import('node:fs/promises')
    const { dataDir } = getDataPaths()
    const lockPath = `${dataDir}/instance.lock`
    const payload = JSON.stringify({ pid: process.pid, startedAt: Date.now() })
    try {
      const prev = JSON.parse(await readFile(lockPath, 'utf8')) as { pid?: number }
      if (prev?.pid && prev.pid !== process.pid) {
        const msg = `[YuqueDL] 检测到其他进程 instance.lock (pid=${prev.pid})。当前为单实例任务队列，请避免多进程同时写同一 data 目录。`
        const strict = String(process.env.YUQUE_DL_STRICT_SINGLE_INSTANCE || '').trim() === '1'
        if (strict && isPidAlive(prev.pid)) {
          throw new Error(`${msg} （YUQUE_DL_STRICT_SINGLE_INSTANCE=1）`)
        }
        console.warn(msg)
      }
    } catch (e: any) {
      if (
        String(process.env.YUQUE_DL_STRICT_SINGLE_INSTANCE || '').trim() === '1' &&
        String(e?.message || '').includes('instance.lock')
      ) {
        throw e
      }
      // no previous lock / non-strict path
    }
    await writeFile(lockPath, payload, { mode: 0o600 })
  } catch (e: any) {
    if (String(e?.message || '').includes('YUQUE_DL_STRICT_SINGLE_INSTANCE')) throw e
    // ignore other lock errors
  }
  try {
    const settings = await readSettings()
    s.maxConcurrency = clampConcurrency(settings.maxConcurrency ?? 1)
  } catch {
    s.maxConcurrency = 1
  }
  const data = await readJobsFile()
  let dirty = false
  for (const task of data.tasks || []) {
    if (task.options?.token) {
      task.options.token = await decryptSecret(task.options.token)
    }
    if (task.options?.password) {
      task.options.password = await decryptSecret(task.options.password)
    }

    if (task.status === 'running') {
      // 正在执行的任务无法跨进程恢复，标记失败
      task.status = 'failed'
      task.error = task.error || '服务重启，任务中断'
      task.message = task.error
      task.finishedAt = Date.now()
      task.logs = task.logs || []
      task.logs.push({
        ts: Date.now(),
        level: 'warn',
        message: '服务重启，任务中断（可重试）',
      })
      dirty = true
    } else if (task.status === 'queued') {
      // 排队任务可在重启后继续
      task.logs = task.logs || []
      task.logs.push({
        ts: Date.now(),
        level: 'info',
        message: '服务重启后恢复排队',
      })
      if (!s.queue.includes(task.id)) s.queue.push(task.id)
      dirty = true
    }

    s.jobs.set(task.id, task)
  }
  if (dirty) {
    await persistJobs()
    // 异步拉起队列，避免阻塞初始化
    void pumpQueue()
  }
}

export async function readSettings(): Promise<AppSettings> {
  await ensureDataDirs()
  const { settingsFile } = getDataPaths()
  try {
    const raw = await readFile(settingsFile, 'utf8')
    const settings = JSON.parse(raw) as AppSettings
    if (settings.token) {
      settings.token = await decryptSecret(settings.token)
    }
    return settings
  } catch {
    return {}
  }
}

export async function writeSettings(settings: AppSettings) {
  await ensureDataDirs()
  const { settingsFile } = getDataPaths()
  const toStore: AppSettings = { ...settings }
  if (toStore.token) {
    toStore.token = await encryptSecret(toStore.token)
  }
  await secureWriteJson(settingsFile, toStore)
  // keep runtime queue concurrency in sync and try to fill free slots
  state().maxConcurrency = clampConcurrency(settings.maxConcurrency ?? 1)
  void pumpQueue()
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

export interface PublicTaskOptions {
  /** 默认 false：列表/轮询不带全量 logs，显著减小 payload */
  includeLogs?: boolean
}

/**
 * 对外安全视图。
 * - 默认不含 logs（仅 logCount），供列表/队列轮询
 * - 详情 / SSE 首包 / 需要完整日志时传 includeLogs: true
 */
export function publicTask(task: TaskRecord, opts: PublicTaskOptions = {}) {
  const includeLogs = opts.includeLogs === true
  const logs = task.logs || []
  const base = {
    id: task.id,
    type: task.type,
    urls: task.urls,
    options: {
      ...task.options,
      token: task.options.token ? maskToken(task.options.token) : '',
      password: task.options.password ? '******' : '',
    },
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    finishedAt: task.finishedAt,
    current: task.current,
    total: task.total,
    message: task.message,
    error: task.error,
    bookPath: task.bookPath,
    bookName: task.bookName,
    targetBooks: task.targetBooks,
    source: task.source,
    scheduleId: task.scheduleId,
    logCount: logs.length,
  }
  if (includeLogs) {
    return { ...base, logs }
  }
  return base
}

const ALLOWED_TASK_TYPES: TaskType[] = ['book', 'docs', 'batch', 'user']

function isHttpUrl(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function guessBookNamesFromUrls(urls: string[]) {
  const names: string[] = []
  for (const url of urls || []) {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean)
      // yuque.com/{user}/{book}/...
      if (parts.length >= 2) names.push(parts[1])
    } catch {
      // ignore
    }
  }
  return [...new Set(names.filter(Boolean))]
}

function isLikelyYuqueUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'yuque.com' || host.endsWith('.yuque.com')
  } catch {
    return false
  }
}

export async function createTask(input: {
  type: TaskType
  urls?: string[]
  options?: TaskOptions
  source?: TaskSource
  scheduleId?: string
}) {
  await loadJobsIntoMemory()
  if (!ALLOWED_TASK_TYPES.includes(input.type)) {
    throw createError({ statusCode: 400, statusMessage: '无效的任务类型' })
  }
  const settings = await readSettings()
  const id = randomUUID()
  const options: TaskOptions = {
    ignoreImg: input.options?.ignoreImg ?? settings.ignoreImg ?? false,
    ignoreAttachments: normalizeIgnoreAttachments(
      input.options?.ignoreAttachments ?? settings.ignoreAttachments ?? false,
    ),
    token: input.options?.token ?? settings.token,
    key: input.options?.key ?? settings.key,
    password: input.options?.password,
    toc: input.options?.toc ?? settings.toc ?? false,
    incremental: input.options?.incremental ?? settings.incremental ?? false,
    convertMarkdownVideoLinks:
      input.options?.convertMarkdownVideoLinks ?? settings.convertMarkdownVideoLinks ?? false,
    hideFooter: input.options?.hideFooter ?? settings.hideFooter ?? false,
  }

  const urls = (input.urls || []).map((u) => u.trim()).filter(Boolean)
  const source: TaskSource = input.source || 'manual'
  const task: TaskRecord = {
    id,
    type: input.type,
    urls,
    options,
    status: 'queued',
    createdAt: Date.now(),
    current: 0,
    total: 0,
    source,
    scheduleId: source === 'schedule' ? input.scheduleId : undefined,
    targetBooks: input.type === 'user' ? [] : guessBookNamesFromUrls(urls),
    logs: [
      {
        ts: Date.now(),
        level: 'info',
        message:
          source === 'schedule'
            ? `任务已创建（定时同步${input.scheduleId ? ` #${String(input.scheduleId).slice(0, 8)}` : ''}），等待执行`
            : source === 'retry'
              ? '任务已创建（重试），等待执行'
              : '任务已创建，等待执行',
      },
    ],
  }

  if (task.type !== 'user' && task.urls.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '请至少提供一个 URL' })
  }
  if (task.type === 'user' && !task.options.token) {
    throw createError({ statusCode: 400, statusMessage: '下载全部知识库需要 token' })
  }
  if (task.type !== 'user') {
    for (const url of task.urls) {
      if (!isHttpUrl(url)) {
        throw createError({ statusCode: 400, statusMessage: `无效 URL: ${url}` })
      }
      if (!isLikelyYuqueUrl(url)) {
        throw createError({ statusCode: 400, statusMessage: `仅支持语雀链接: ${url}` })
      }
    }
  }

  const { jobs, queue } = state()
  jobs.set(id, task)
  queue.push(id)
  await persistJobs()
  emitTask(id, { type: 'task', task: publicTask(task, { includeLogs: true }) })
  void pumpQueue()
  return publicTask(task, { includeLogs: true })
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
    task.error = '已取消'
    task.message = '已取消'
    appendLog(task, 'warn', '任务已取消')
    await persistJobs()
    emitTask(id, { type: 'task', task: publicTask(task, { includeLogs: true }) })
    return publicTask(task, { includeLogs: true })
  }

  if (task.status === 'running') {
    // Abort underlying download and surface cancelled immediately for API clients.
    // runTask will finalize cleanup without flipping status back to success.
    controllers.get(id)?.abort()
    task.status = 'cancelled'
    task.error = '已取消'
    task.message = '已取消'
    task.finishedAt = Date.now()
    appendLog(task, 'warn', '任务已取消')
    await persistJobs()
    emitTask(id, { type: 'task', task: publicTask(task, { includeLogs: true }) })
    return publicTask(task, { includeLogs: true })
  }

  return publicTask(task, { includeLogs: true })
}

export async function retryTask(id: string) {
  await loadJobsIntoMemory()
  const { jobs, queue } = state()
  const task = jobs.get(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  if (task.status !== 'failed' && task.status !== 'cancelled') {
    throw createError({ statusCode: 400, statusMessage: '只有失败或已取消的任务可以重试' })
  }

  // 重置任务状态；保留 scheduleId 关联，source 记为 retry
  task.status = 'queued'
  task.startedAt = undefined
  task.finishedAt = undefined
  task.current = 0
  task.total = 0
  task.error = undefined
  task.message = '等待重试'
  task.source = 'retry'
  task.logs.push({ ts: Date.now(), level: 'info', message: '任务已重置，等待重试' })
  if (task.logs.length > 200) task.logs = task.logs.slice(-200)

  queue.push(id)
  await persistJobs()
  emitTask(id, { type: 'task', task: publicTask(task, { includeLogs: true }) })
  void pumpQueue()
  return publicTask(task, { includeLogs: true })
}

export async function deleteTask(id: string) {
  await loadJobsIntoMemory()
  const { jobs, controllers, queue, sse } = state()
  const task = jobs.get(id)
  if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })

  // 排队中：先移出队列
  if (task.status === 'queued') {
    const idx = queue.indexOf(id)
    if (idx >= 0) queue.splice(idx, 1)
  }

  // 运行中：先中止
  if (task.status === 'running') {
    controllers.get(id)?.abort()
  }

  controllers.delete(id)
  jobs.delete(id)
  sse.delete(id)
  await persistJobs()
  return { ok: true, id }
}

async function pumpQueue() {
  const s = state()
  while (s.active.size < s.maxConcurrency && s.queue.length > 0) {
    const nextId = s.queue.shift()
    if (!nextId) break
    // skip missing/cancelled tasks
    const task = s.jobs.get(nextId)
    if (!task || (task.status !== 'queued' && task.status !== 'running')) continue
    s.active.add(nextId)
    void runTask(nextId)
      .catch(() => {
        // runTask already records failures
      })
      .finally(() => {
        s.active.delete(nextId)
        if (s.queue.length > 0) void pumpQueue()
      })
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
  emitTask(id, { type: 'task', task: publicTask(task, { includeLogs: true }) })
  await persistJobs()

  try {
    const { downloadsDir } = getDataPaths()
    const { pathToFileURL } = await import('node:url')
    const { resolveCoreEntry } = await import('./paths')
    const coreEntry = await resolveCoreEntry()
    const core = await import(pathToFileURL(coreEntry).href)

    appendLog(task, 'info', `输出目录: ${downloadsDir}`)

    const options = {
      distDir: downloadsDir,
      ignoreImg: Boolean(task.options.ignoreImg),
      ignoreAttachments: normalizeIgnoreAttachments(task.options.ignoreAttachments ?? false),
      token: task.options.token,
      key: task.options.key,
      password: task.options.password,
      toc: Boolean(task.options.toc),
      incremental: Boolean(task.options.incremental),
      convertMarkdownVideoLinks: Boolean(task.options.convertMarkdownVideoLinks),
      hideFooter: Boolean(task.options.hideFooter),
    }

    /** 进度回调 → 任务状态 + 运行日志（含保存路径） */
    const handleProgress = (
      payload: {
        current: number
        total: number
        message?: string
        phase?: string
        success?: boolean
        item?: { path?: string; toc?: { title?: string } }
        filePath?: string
      },
      bookPrefix = '',
    ) => {
      task.current = payload.current
      task.total = payload.total
      if (payload.message) task.message = bookPrefix + payload.message
      emitTask(id, {
        type: 'progress',
        current: task.current,
        total: task.total,
        message: task.message,
        phase: payload.phase,
      })

      const phase = payload.phase || ''
      if (phase === 'item') {
        const rel = payload.item?.path || payload.message || ''
        const abs = payload.filePath || rel
        const title = payload.item?.toc?.title
        const progress = payload.total
          ? `[${payload.current}/${payload.total}] `
          : ''
        const namePart = title && title !== rel ? `「${title}」 ` : ''
        if (payload.success === false) {
          appendLog(task, 'error', `${bookPrefix}${progress}下载失败 ${namePart}${abs}`)
        } else if (rel || abs) {
          const isFile = /\.(md|markdown)$/i.test(rel) || /\.(md|markdown)$/i.test(abs)
          appendLog(
            task,
            'info',
            isFile
              ? `${bookPrefix}${progress}已保存 ${namePart}${abs}`
              : `${bookPrefix}${progress}目录 ${namePart}${abs}`,
          )
        }
      } else if (phase === 'done' && payload.message) {
        appendLog(task, 'info', `${bookPrefix}知识库目录: ${payload.message}`)
      } else if ((phase === 'init' || phase === 'start') && payload.message) {
        appendLog(task, 'info', `${bookPrefix}${payload.message}`)
      }
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
        success?: boolean
        item?: { path?: string; toc?: { title?: string } }
        filePath?: string
      }) => handleProgress(payload),
    }

    let result: any
    const touchedBooks = new Set<string>(task.targetBooks || [])
    if (task.type === 'book') {
      result = await core.main(task.urls[0], options, hooks)
      if (result?.bookName) touchedBooks.add(String(result.bookName))
    } else if (task.type === 'docs') {
      result = await core.downloadDocsFromUrls(task.urls, options, hooks)
    } else if (task.type === 'batch') {
      // batch：外层进度只在库切换时更新；文档进度由 main hooks 覆盖 current/total 时保留库序号信息
      const bookTotal = task.urls.length
      for (let i = 0; i < task.urls.length; i++) {
        const url = task.urls[i]
        if (controller.signal.aborted) throw new Error('Download aborted')
        appendLog(task, 'info', `开始下载知识库(${i + 1}/${bookTotal}): ${url}`)
        // 使用 phase 标记库序号，不抢占文档进度的 current/total 语义
        emitTask(id, {
          type: 'progress',
          current: task.current,
          total: task.total,
          message: `知识库 ${i + 1}/${bookTotal}`,
          phase: `book:${i + 1}/${bookTotal}`,
        })
        task.message = `知识库 ${i + 1}/${bookTotal}`
        const bookPrefix = `[库 ${i + 1}/${bookTotal}] `
        const bookHooks = {
          ...hooks,
          onProgress: (payload: {
            current: number
            total: number
            message?: string
            phase?: string
            success?: boolean
            item?: { path?: string; toc?: { title?: string } }
            filePath?: string
          }) => handleProgress(payload, bookPrefix),
        }
        result = await core.main(url, options, bookHooks)
        if (result?.bookName) touchedBooks.add(String(result.bookName))
      }
    } else if (task.type === 'user') {
      result = await core.downloadUserBooks(options, hooks)
    } else {
      throw new Error(`不支持的任务类型: ${task.type}`)
    }

    // Prefer cancel if abort was requested or cancelTask already flipped status.
    if (controller.signal.aborted || task.status === 'cancelled') {
      task.status = 'cancelled'
      task.error = '已取消'
      task.message = '已取消'
      if (!task.logs?.some((l) => l.message === '任务已取消')) {
        appendLog(task, 'warn', '任务已取消')
      }
    } else {
      task.status = 'success'
      task.message = '下载完成'
      task.error = undefined
      if (result?.bookPath) task.bookPath = result.bookPath
      if (result?.bookName) {
        task.bookName = result.bookName
        touchedBooks.add(String(result.bookName))
      }
      task.targetBooks = [...touchedBooks]
      if (result?.bookPath) {
        appendLog(task, 'info', `任务完成，文件位于: ${result.bookPath}`)
      } else {
        appendLog(task, 'info', `任务完成，输出目录: ${downloadsDir}`)
      }
    }
  } catch (err: any) {
    if (
      controller.signal.aborted ||
      task.status === 'cancelled' ||
      /abort/i.test(String(err?.message || ''))
    ) {
      task.status = 'cancelled'
      task.error = '已取消'
      task.message = '已取消'
      if (!task.logs?.some((l) => l.message === '任务已取消')) {
        appendLog(task, 'warn', '任务已取消')
      }
    } else {
      task.status = 'failed'
      const classified = classifyTaskError(err)
      task.error = classified.message
      task.message = classified.message
      appendLog(task, 'error', classified.message)
      if (classified.raw && classified.raw !== classified.message) {
        appendLog(task, 'debug', `原始错误: ${classified.raw.slice(0, 300)}`)
      }
    }
  } finally {
    task.finishedAt = Date.now()
    controllers.delete(id)
    // never let a late success overwrite an explicit cancel
    if (controller.signal.aborted && task.status !== 'cancelled') {
      task.status = 'cancelled'
      task.error = '已取消'
      task.message = '已取消'
    }
    emitTask(id, { type: 'task', task: publicTask(task, { includeLogs: true }) })
    emitTask(id, { type: 'done', task: publicTask(task, { includeLogs: true }) })
    await persistJobs()
  }
}
