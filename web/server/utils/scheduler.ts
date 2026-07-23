import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { ensureDataDirs, getDataPaths } from './paths'
import { secureWriteJson } from './security'
import { createTask } from './store'

export type ScheduleInterval = 'hourly' | 'daily' | 'weekly'

export interface ScheduleRecord {
  id: string
  url: string
  interval: ScheduleInterval
  enabled: boolean
  createdAt: number
  updatedAt: number
  nextRunAt: number
  lastRunAt?: number
  lastStatus?: 'queued' | 'success' | 'failed' | 'skipped'
  lastError?: string
  lastTaskId?: string
  /** prevent overlapping runs for same schedule */
  running?: boolean
}

const INTERVAL_MS: Record<ScheduleInterval, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

const g = globalThis as typeof globalThis & {
  __yuqueSchedules?: Map<string, ScheduleRecord>
  __yuqueScheduleTimer?: ReturnType<typeof setInterval> | null
  __yuqueScheduleStarted?: boolean
}

function state() {
  if (!g.__yuqueSchedules) g.__yuqueSchedules = new Map()
  return g.__yuqueSchedules
}

export function isValidInterval(v: unknown): v is ScheduleInterval {
  return v === 'hourly' || v === 'daily' || v === 'weekly'
}

export function intervalLabel(v: ScheduleInterval) {
  return ({ hourly: '每小时', daily: '每天', weekly: '每周' } as const)[v]
}

function computeNextRunAt(from: number, interval: ScheduleInterval) {
  return from + INTERVAL_MS[interval]
}

function isYuqueUrl(url: string) {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    return (host === 'yuque.com' || host.endsWith('.yuque.com')) && u.protocol.startsWith('http')
  } catch {
    return false
  }
}

async function persist() {
  await ensureDataDirs()
  const { schedulesFile } = getDataPaths()
  const list = [...state().values()].sort((a, b) => b.createdAt - a.createdAt)
  await secureWriteJson(schedulesFile, { schedules: list })
}

export async function loadSchedulesIntoMemory() {
  await ensureDataDirs()
  const map = state()
  if (map.size > 0) return
  const { schedulesFile } = getDataPaths()
  try {
    const raw = await readFile(schedulesFile, 'utf8')
    const data = JSON.parse(raw) as { schedules?: ScheduleRecord[] }
    for (const item of data.schedules || []) {
      if (!item?.id || !item?.url) continue
      map.set(item.id, {
        ...item,
        interval: isValidInterval(item.interval) ? item.interval : 'daily',
        enabled: item.enabled !== false,
        running: false,
      })
    }
  } catch {
    // empty
  }
}

export async function listSchedules() {
  await loadSchedulesIntoMemory()
  return [...state().values()].sort((a, b) => b.createdAt - a.createdAt)
}

export async function getSchedule(id: string) {
  await loadSchedulesIntoMemory()
  return state().get(id)
}

export async function createSchedule(input: {
  url: string
  interval?: ScheduleInterval
  enabled?: boolean
}) {
  await loadSchedulesIntoMemory()
  const url = String(input.url || '').trim()
  if (!url) throw createError({ statusCode: 400, statusMessage: '请填写知识库 URL' })
  if (!isYuqueUrl(url)) throw createError({ statusCode: 400, statusMessage: '仅支持语雀知识库链接' })
  const interval = isValidInterval(input.interval) ? input.interval : 'daily'
  const now = Date.now()
  const item: ScheduleRecord = {
    id: randomUUID(),
    url,
    interval,
    enabled: input.enabled !== false,
    createdAt: now,
    updatedAt: now,
    nextRunAt: now, // 新建后可立即被 tick / 手动 run
    running: false,
  }
  state().set(item.id, item)
  await persist()
  return item
}

export async function updateSchedule(
  id: string,
  patch: Partial<Pick<ScheduleRecord, 'url' | 'interval' | 'enabled'>>,
) {
  await loadSchedulesIntoMemory()
  const cur = state().get(id)
  if (!cur) throw createError({ statusCode: 404, statusMessage: '定时任务不存在' })

  if (patch.url !== undefined) {
    const url = String(patch.url || '').trim()
    if (!url) throw createError({ statusCode: 400, statusMessage: '请填写知识库 URL' })
    if (!isYuqueUrl(url)) throw createError({ statusCode: 400, statusMessage: '仅支持语雀知识库链接' })
    cur.url = url
  }
  if (patch.interval !== undefined) {
    if (!isValidInterval(patch.interval)) {
      throw createError({ statusCode: 400, statusMessage: '无效的同步周期' })
    }
    cur.interval = patch.interval
  }
  if (patch.enabled !== undefined) {
    cur.enabled = Boolean(patch.enabled)
    if (cur.enabled && cur.nextRunAt < Date.now()) {
      cur.nextRunAt = Date.now()
    }
  }
  cur.updatedAt = Date.now()
  state().set(id, cur)
  await persist()
  return cur
}

export async function deleteSchedule(id: string) {
  await loadSchedulesIntoMemory()
  if (!state().has(id)) throw createError({ statusCode: 404, statusMessage: '定时任务不存在' })
  state().delete(id)
  await persist()
  return { ok: true }
}

/** Global schedule budget (anti storm when token invalid). Override via env. */
function scheduleBudgetConfig() {
  const maxPerDay = Math.max(1, Number(process.env.YUQUE_DL_SCHEDULE_MAX_PER_DAY || 48) || 48)
  const maxPerHour = Math.max(1, Number(process.env.YUQUE_DL_SCHEDULE_MAX_PER_HOUR || 12) || 12)
  const cooldownMs = Math.max(
    0,
    Number(process.env.YUQUE_DL_SCHEDULE_COOLDOWN_MS || 5 * 60 * 1000) || 5 * 60 * 1000,
  )
  return { maxPerDay, maxPerHour, cooldownMs }
}

const budgetState = globalThis as typeof globalThis & {
  __yuqueScheduleBudget?: { dayKey: string; dayCount: number; hourKey: string; hourCount: number; lastEnqueueAt: number }
}

function getBudget() {
  if (!budgetState.__yuqueScheduleBudget) {
    budgetState.__yuqueScheduleBudget = {
      dayKey: '',
      dayCount: 0,
      hourKey: '',
      hourCount: 0,
      lastEnqueueAt: 0,
    }
  }
  return budgetState.__yuqueScheduleBudget
}

function dayKeyOf(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function hourKeyOf(ts: number) {
  const d = new Date(ts)
  return `${dayKeyOf(ts)}-${d.getHours()}`
}

/**
 * Check global schedule enqueue budget.
 * Manual "立即运行" also counts (stability, not only auto tick).
 */
function assertScheduleBudget() {
  const { maxPerDay, maxPerHour, cooldownMs } = scheduleBudgetConfig()
  const now = Date.now()
  const b = getBudget()
  const dayKey = dayKeyOf(now)
  const hourKey = hourKeyOf(now)
  if (b.dayKey !== dayKey) {
    b.dayKey = dayKey
    b.dayCount = 0
  }
  if (b.hourKey !== hourKey) {
    b.hourKey = hourKey
    b.hourCount = 0
  }
  if (cooldownMs > 0 && b.lastEnqueueAt && now - b.lastEnqueueAt < cooldownMs) {
    const waitSec = Math.ceil((cooldownMs - (now - b.lastEnqueueAt)) / 1000)
    throw createError({
      statusCode: 429,
      statusMessage: `定时同步冷却中，请 ${waitSec} 秒后再试（防 Token 失效狂失败）`,
    })
  }
  if (b.hourCount >= maxPerHour) {
    throw createError({
      statusCode: 429,
      statusMessage: `本小时定时同步已达上限（${maxPerHour} 次），请稍后再试`,
    })
  }
  if (b.dayCount >= maxPerDay) {
    throw createError({
      statusCode: 429,
      statusMessage: `今日定时同步已达上限（${maxPerDay} 次），请明天再试`,
    })
  }
}

function consumeScheduleBudget() {
  const now = Date.now()
  const b = getBudget()
  const dayKey = dayKeyOf(now)
  const hourKey = hourKeyOf(now)
  if (b.dayKey !== dayKey) {
    b.dayKey = dayKey
    b.dayCount = 0
  }
  if (b.hourKey !== hourKey) {
    b.hourKey = hourKey
    b.hourCount = 0
  }
  b.dayCount += 1
  b.hourCount += 1
  b.lastEnqueueAt = now
}

export async function runSchedule(id: string, opts: { manual?: boolean } = {}) {
  await loadSchedulesIntoMemory()
  const item = state().get(id)
  if (!item) throw createError({ statusCode: 404, statusMessage: '定时任务不存在' })
  if (item.running) {
    return { ok: false, skipped: true, message: '该定时任务正在执行中', schedule: item }
  }

  // 全局预算：自动/手动都计，防止失效 Token 狂打语雀
  try {
    assertScheduleBudget()
  } catch (e: any) {
    // 自动 tick 预算耗尽：跳过并顺延，不抛 500
    if (!opts.manual) {
      item.lastStatus = 'skipped'
      item.lastError = e?.statusMessage || e?.message || '全局预算限制'
      item.nextRunAt = computeNextRunAt(Date.now(), item.interval)
      item.updatedAt = Date.now()
      state().set(id, item)
      await persist()
      return { ok: false, skipped: true, message: item.lastError, schedule: item }
    }
    throw e
  }

  item.running = true
  item.updatedAt = Date.now()
  state().set(id, item)
  await persist()

  try {
    const task = await createTask({
      type: 'book',
      urls: [item.url],
      options: {
        incremental: true,
      },
      source: 'schedule',
      scheduleId: item.id,
    })
    consumeScheduleBudget()
    item.lastRunAt = Date.now()
    item.lastStatus = 'queued'
    item.lastError = undefined
    item.lastTaskId = task.id
    item.nextRunAt = computeNextRunAt(Date.now(), item.interval)
    item.running = false
    item.updatedAt = Date.now()
    state().set(id, item)
    await persist()
    return {
      ok: true,
      task,
      schedule: item,
      message: opts.manual ? '已创建增量同步任务' : '定时同步已入队',
    }
  } catch (e: any) {
    item.running = false
    item.lastRunAt = Date.now()
    item.lastStatus = 'failed'
    item.lastError = e?.statusMessage || e?.message || '创建任务失败'
    // 失败也顺延，避免狂重试打爆
    item.nextRunAt = computeNextRunAt(Date.now(), item.interval)
    item.updatedAt = Date.now()
    state().set(id, item)
    await persist()
    throw createError({
      statusCode: e?.statusCode || 500,
      statusMessage: item.lastError,
    })
  }
}

async function tick() {
  try {
    await loadSchedulesIntoMemory()
    const now = Date.now()
    const due = [...state().values()]
      .filter((s) => s.enabled && !s.running && Number(s.nextRunAt || 0) <= now)
      .sort((a, b) => Number(a.nextRunAt || 0) - Number(b.nextRunAt || 0))
    // 错峰：每次最多触发 1 条，其余留给下一分钟
    if (due[0]) {
      await runSchedule(due[0].id)
    }
  } catch (e) {
    console.error('[scheduler] tick failed', e)
  }
}

export function startScheduler() {
  if (g.__yuqueScheduleStarted) return
  g.__yuqueScheduleStarted = true
  // 启动后稍等再 tick，避免和 boot 抢资源
  setTimeout(() => {
    void tick()
  }, 5000)
  if (g.__yuqueScheduleTimer) clearInterval(g.__yuqueScheduleTimer)
  g.__yuqueScheduleTimer = setInterval(() => {
    void tick()
  }, 60 * 1000)
  // 不阻止进程退出
  g.__yuqueScheduleTimer.unref?.()
}
