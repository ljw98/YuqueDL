<template>
  <div class="page-fill tasks-page">
    <div class="page-header">
      <div>
        <h1>任务中心</h1>
        <p>查看下载历史与进度，管理定时同步。</p>
      </div>
    </div>

    <div class="panel schedule-panel">
      <div class="panel-head">
        <h3 class="panel-title">定时同步</h3>
      </div>
      <p class="panel-desc">到点自动创建增量下载，进度见下方列表。</p>

      <div class="schedule-form" :class="{ 'is-mobile': isMobile }">
        <!-- 手机：周期独立一行，避免 prepend 挤爆 -->
        <el-select
          v-if="isMobile"
          v-model="scheduleForm.interval"
          size="large"
          class="schedule-interval-select-mobile"
          placeholder="间隔"
        >
          <el-option label="每小时" value="hourly" />
          <el-option label="每天" value="daily" />
          <el-option label="每周" value="weekly" />
        </el-select>
        <el-input
          v-model="scheduleForm.url"
          size="large"
          class="schedule-url-input"
          placeholder="https://www.yuque.com/xxx/yyy"
        >
          <template v-if="!isMobile" #prepend>
            <el-select
              v-model="scheduleForm.interval"
              size="large"
              class="schedule-interval-select"
              placeholder="间隔"
            >
              <el-option label="每小时" value="hourly" />
              <el-option label="每天" value="daily" />
              <el-option label="每周" value="weekly" />
            </el-select>
          </template>
        </el-input>
        <el-button type="primary" size="large" :loading="creatingSchedule" @click="addSchedule">添加</el-button>
      </div>

      <div class="schedule-table-wrap">
        <el-table
          class="schedule-table"
          v-loading="loadingSchedules"
          :data="schedules"
          empty-text="暂无定时同步"
          border
          style="width:100%;"
          :max-height="scheduleTableMaxHeight"
        >
          <el-table-column label="知识库 URL" :min-width="isMobile ? 140 : 180">
            <template #default="{ row }">
              <a class="schedule-url" :href="row.url" target="_blank" rel="noopener">{{ prettyUrl(row.url) }}</a>
              <div v-if="isMobile && row.lastError" class="schedule-error">{{ row.lastError }}</div>
            </template>
          </el-table-column>
          <el-table-column label="间隔" :width="isMobile ? 64 : 70" align="center">
            <template #default="{ row }">
              <el-tag class="status-tag" :type="intervalType(row.interval)" size="small" effect="light">
                {{ intervalText(row.interval) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="启用" :width="isMobile ? 56 : 70" align="center">
            <template #default="{ row }">
              <el-switch
                size="small"
                :model-value="row.enabled"
                style="--el-switch-on-color: #31CC79;"
                @change="(v) => toggleSchedule(row, v)"
              />
            </template>
          </el-table-column>
          <el-table-column v-if="!isMobile" label="上次执行" width="180">
            <template #default="{ row }">
              <span class="muted">{{ formatScheduleTime(row.lastRunAt) }}</span>
              <div v-if="row.lastError" class="schedule-error">{{ row.lastError }}</div>
            </template>
          </el-table-column>
          <el-table-column v-if="!isMobile" label="下次执行" width="180">
            <template #default="{ row }">
              <span class="muted">{{ row.enabled ? formatScheduleTime(row.nextRunAt) : '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" :width="isMobile ? 88 : 170" :fixed="isMobile ? 'right' : false">
            <template #default="{ row }">
              <div class="table-ops" :class="{ 'is-mobile': isMobile }">
                <el-button size="small" :loading="runningId === row.id" @click="runOne(row)">
                  {{ isMobile ? '运行' : '立即运行' }}
                </el-button>
                <el-button size="small" type="danger" @click="removeSchedule(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <div class="panel tasks-table-panel">
      <div class="panel-head">
        <h3 class="panel-title">下载任务</h3>
      </div>
      <p class="panel-desc">历史与进行中任务，支持取消、详情与重试。</p>

      <div class="tasks-table-wrap">
        <el-table
          class="tasks-table"
          :data="tasks"
          v-loading="loading"
          empty-text="暂无任务"
          border
          :max-height="tasksTableMaxHeight"
          style="width:100%;"
        >
          <template #empty>
            <div class="tasks-empty">
              <svg class="tasks-empty-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="88" height="88">
                <path d="M832.7 63.9H189.6c-69.6 0-126.3 56.7-126.3 126.3v643.1c0 69.6 56.7 126.3 126.3 126.3h643.1c69.6 0 126.3-56.7 126.3-126.3V190.2c0-69.7-56.6-126.3-126.3-126.3zM276.3 339.1l39.6-39.6 51.7 51.7 51.7-51.7 39.6 39.6-51.7 51.7 51.7 51.7-39.6 39.5-51.7-51.7-51.7 51.7-39.6-39.6 51.7-51.7-51.7-51.6z m37 430.9c0-111.5 90.4-201.8 201.8-201.8S716.9 658.5 716.9 770H313.3zM746 442.4L706.5 482l-51.7-51.7-51.7 51.7-39.6-39.6 51.7-51.7-51.7-51.7 39.6-39.6 51.7 51.7 51.7-51.7L746 339l-51.7 51.7 51.7 51.7z" fill="#B3B3B3" />
              </svg>
              <div class="tasks-empty-title">暂无任务</div>
            </div>
          </template>
          <el-table-column label="知识库 URL" :min-width="isMobile ? 132 : 180">
            <template #default="{ row }">
              <div v-if="row.type === 'user'">账号全部知识库</div>
              <div v-else class="task-url-cell">
                <a
                  v-for="(url, idx) in row.urls || []"
                  :key="idx"
                  class="schedule-url"
                  :href="url"
                  target="_blank"
                  rel="noopener"
                  @click.stop
                >
                  {{ prettyUrl(url) }}
                  <span v-if="idx < (row.urls || []).length - 1" class="task-url-sep">|</span>
                </a>
              </div>
              <div v-if="isMobile" class="task-meta-mobile">
                <el-tag class="status-tag" :type="statusType(row.status)" size="small" effect="light">{{ statusText(row.status) }}</el-tag>
                <span class="muted">{{ row.current || 0 }}/{{ row.total || 0 }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column v-if="!isMobile" label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-tag class="status-tag" :type="statusType(row.status)" size="small" effect="light">{{ statusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="!isMobile" label="来源" width="78" align="center">
            <template #default="{ row }">
              <el-tag class="status-tag" :type="sourceType(row.source)" size="small" effect="light">
                {{ sourceText(row.source) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="!isMobile" label="进度" width="100">
            <template #default="{ row }">
              {{ row.current || 0 }}/{{ row.total || 0 }}
            </template>
          </el-table-column>
          <el-table-column v-if="!isMobile" label="创建时间" width="180">
            <template #default="{ row }">
              <span class="muted">{{ formatTime(row.createdAt) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" :width="isMobile ? 96 : 240" :fixed="isMobile ? 'right' : false">
            <template #default="{ row }">
              <div v-if="isMobile" class="table-ops is-mobile">
                <el-button size="small" @click="showDetail(row)">详情</el-button>
                <el-dropdown trigger="click" @command="(cmd) => onTaskMobileCommand(cmd, row)">
                  <el-button size="small">
                    更多
                    <span class="ops-caret">▾</span>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-if="row.status === 'running' || row.status === 'queued'"
                        command="cancel"
                      >取消</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.status === 'failed' || row.status === 'cancelled'"
                        command="retry"
                      >重试</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>
                        <span class="ops-danger">删除</span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div v-else class="table-ops">
                <el-button
                  v-if="row.status === 'running' || row.status === 'queued'"
                  size="small"
                  @click="cancel(row.id)"
                >
                  取消
                </el-button>
                <el-button size="small" @click="showDetail(row)">详情</el-button>
                <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
                <el-button
                  v-if="row.status === 'failed' || row.status === 'cancelled'"
                  size="small"
                  type="warning"
                  @click="retry(row.id)"
                >
                  重试
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-drawer
      v-model="drawer"
      :size="drawerSize"
      class="task-detail-drawer"
      :with-header="true"
    >
      <template #header>
        <div class="detail-header">
          <div class="detail-title">任务详情</div>
        </div>
      </template>

      <template v-if="current">
        <div class="detail-summary">
          <div class="detail-metric">
            <div class="detail-metric-label">进度</div>
            <div class="detail-metric-value">{{ current.current || 0 }}/{{ current.total || 0 }}</div>
            <el-progress
              :percentage="progressPercent(current)"
              :stroke-width="8"
              :show-text="false"
              color="#31CC79"
            />
          </div>

          <div class="detail-info-grid">
            <div class="detail-info-item">
              <div class="detail-info-label">类型</div>
              <div class="detail-info-value">{{ typeText(current.type) }}</div>
            </div>
            <div class="detail-info-item">
              <div class="detail-info-label">来源</div>
              <div class="detail-info-value">
                <el-tag class="status-tag" :type="sourceType(current.source)" size="small" effect="light">
                  {{ sourceText(current.source) }}
                </el-tag>
              </div>
            </div>
            <div class="detail-info-item">
              <div class="detail-info-label">创建时间</div>
              <div class="detail-info-value">{{ formatTime(current.createdAt) }}</div>
            </div>
            <div class="detail-info-item" v-if="current.bookName">
              <div class="detail-info-label">知识库</div>
              <div class="detail-info-value">{{ current.bookName }}</div>
            </div>
            <div class="detail-info-item">
              <div class="detail-info-label">状态</div>
              <div class="detail-info-value">
                <el-tag class="status-tag" :type="statusType(current.status)" size="small" effect="light">
                  {{ statusText(current.status) }}
                </el-tag>
              </div>
            </div>
            <div class="detail-info-item" v-if="current.scheduleId">
              <div class="detail-info-label">定时规则</div>
              <div class="detail-info-value detail-schedule-link">
                <span class="muted">#{{ String(current.scheduleId).slice(0, 8) }}</span>
                <span v-if="scheduleUrlOf(current.scheduleId)" class="schedule-rule-url">
                  {{ prettyUrl(scheduleUrlOf(current.scheduleId)!) }}
                </span>
              </div>
            </div>
            <div class="detail-info-item" v-if="current.message">
              <div class="detail-info-label">消息</div>
              <div class="detail-info-value">{{ current.message }}</div>
            </div>
          </div>

          <div v-if="current.error" class="detail-error">
            <div class="detail-error-label">错误</div>
            <div class="detail-error-text">{{ current.error }}</div>
          </div>

          <div v-if="current.type !== 'user' && (current.urls || []).length" class="detail-urls">
            <div class="detail-info-label">知识库 URL</div>
            <div class="detail-url-list">
              <a
                v-for="(url, idx) in current.urls || []"
                :key="idx"
                :href="url"
                target="_blank"
                class="detail-url"
              >
                {{ shortUrl(url) }}
              </a>
            </div>
          </div>
          <div v-else-if="current.type === 'user'" class="detail-urls">
            <div class="detail-info-label">知识库 URL</div>
            <div class="detail-info-value">账号全部知识库</div>
          </div>
        </div>

        <div class="detail-log-section">
          <div class="detail-log-header">
            <span>运行日志</span>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="detail-log-live" :class="`live-${liveStatus}`">{{ liveStatusText }}</span>
              <span class="detail-log-count">{{ (current.logs || []).length }} 条</span>
            </div>
          </div>
          <div class="log-box detail-log-box">
            <div
              v-for="(line, i) in current.logs || []"
              :key="i"
              class="detail-log-line"
              :class="`log-line-${line.level}`"
            >
              <span class="detail-log-time">{{ formatTime(line.ts) }}</span>
              <span class="detail-log-msg">{{ line.message }}</span>
            </div>
            <div v-if="!(current.logs || []).length" class="detail-log-empty">暂无日志</div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import type { TaskRecord } from '~/types/api'

const tasks = ref<TaskRecord[]>([])
const loading = ref(false)
const drawer = ref(false)
const drawerSize = ref('460px')
const isMobile = ref(false)
let _mqMobile: MediaQueryList | null = null

function syncMobileFlag() {
  if (!import.meta.client) return
  isMobile.value = window.matchMedia('(max-width: 900px)').matches
  drawerSize.value = window.innerWidth <= 720 ? '100%' : '460px'
  scheduleTableMaxHeight.value = isMobile.value ? 180 : 200
}

function updateDrawerSize() {
  syncMobileFlag()
}
const current = ref<TaskRecord | null>(null)
const liveStatus = ref<'idle' | 'connecting' | 'live' | 'error' | 'closed'>('idle')
const liveStatusText = computed(() => ({
  idle: '未连接',
  connecting: '连接中…',
  live: '实时中',
  error: '连接异常，重试中',
  closed: '已断开',
}[liveStatus.value]))

const schedules = ref<any[]>([])
const loadingSchedules = ref(false)
const creatingSchedule = ref(false)
const runningId = ref('')
const scheduleForm = reactive({
  url: '',
  interval: 'daily' as 'hourly' | 'daily' | 'weekly',
})

function typeText(t: string) {
  return ({ book: '整库', docs: '文档', batch: '批量', user: '账号全部' } as any)[t] || t
}
function statusText(s: string) {
  return ({ queued: '排队中', running: '下载中', success: '成功', failed: '失败', cancelled: '已取消' } as any)[s] || s
}
function statusType(s: string) {
  return ({ queued: 'info', running: '', success: 'success', failed: 'danger', cancelled: 'warning' } as any)[s] || 'info'
}
function sourceText(s?: string) {
  return ({ manual: '手动', schedule: '定时', retry: '重试' } as any)[s || 'manual'] || '手动'
}
function sourceType(s?: string) {
  return ({ manual: 'info', schedule: 'success', retry: 'warning' } as any)[s || 'manual'] || 'info'
}
function scheduleUrlOf(id?: string) {
  if (!id) return ''
  const hit = schedules.value.find((x) => x.id === id)
  return hit?.url || ''
}
function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}
function shortUrl(url: string) {
  return String(url || '')
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^yuque\.com\//i, '')
}
function progressPercent(task: any) {
  const total = Number(task?.total || 0)
  const current = Number(task?.current || 0)
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

function intervalText(v: string) {
  return ({ hourly: '每小时', daily: '每天', weekly: '每周' } as any)[v] || v
}
function intervalType(v: string) {
  // 对齐状态列 light tag：信息/主色/警告区分周期
  return ({ hourly: 'info', daily: '', weekly: 'warning' } as any)[v] || 'info'
}

function prettyUrl(url: string) {
  return String(url || '').replace(/^https?:\/\/(www\.)?/, '')
}

function formatScheduleTime(ts?: number) {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return '—'
  }
}

async function loadSchedules() {
  loadingSchedules.value = true
  try {
    const res = await $fetch<{ schedules: any[] }>('/api/schedules')
    schedules.value = res.schedules || []
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载定时同步失败')
  } finally {
    loadingSchedules.value = false
  }
}

async function addSchedule() {
  const url = scheduleForm.url.trim()
  if (!url) {
    ElMessage.warning('请填写知识库 URL')
    return
  }
  creatingSchedule.value = true
  try {
    await $fetch('/api/schedules', {
      method: 'POST',
      body: { url, interval: scheduleForm.interval, enabled: true },
    })
    scheduleForm.url = ''
    ElMessage.success('已添加定时同步')
    await loadSchedules()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '添加失败')
  } finally {
    creatingSchedule.value = false
  }
}

async function toggleSchedule(row: any, enabled: any) {
  try {
    await $fetch(`/api/schedules/${row.id}`, {
      method: 'PUT',
      body: { enabled: Boolean(enabled) },
    })
    row.enabled = Boolean(enabled)
    ElMessage.success(enabled ? '已启用' : '已暂停')
    await loadSchedules()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '更新失败')
  }
}

async function runOne(row: any) {
  runningId.value = row.id
  try {
    const res = await $fetch<any>(`/api/schedules/${row.id}/run`, { method: 'POST' })
    ElMessage.success(res?.message || '已创建任务')
    await loadSchedules()
    await refresh()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '运行失败')
  } finally {
    runningId.value = ''
  }
}

async function removeSchedule(row: any) {
  const html = `
    <div class="delete-task-dialog-body">
      <div class="delete-task-icon" aria-hidden="true">
        <svg viewBox="0 0 1024 1024" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
          <path d="M865.392459 157.253321c23.31613 0 42.500482 3.834822 57.675935 11.540307 15.119133 7.705484 27.161193 17.32582 36.049379 28.866127 8.954746 11.509587 15.175452 24.01756 18.66724 37.503437 3.486668 13.465398 5.227442 25.963131 5.227442 37.503437 0 5.411759-0.168957 9.620336-0.573431 12.702529-0.409594 3.051474-0.578551 5.785513-0.578551 8.053639l0 6.942616-76.865407 0 0 605.871232c0 15.416089-3.087314 30.238266-9.3029 44.481893-6.220707 14.187307-15.175452 26.746479-26.807918 37.503437-11.627346 10.751839-25.814653 19.414749-42.500482 25.922171-16.69095 6.579101-35.870182 9.830253-57.624736 9.830253L249.378659 1023.9744c-20.182737 0-39.193012-3.082194-57.102503-9.246581-17.842932-6.164388-33.131023-14.827298-45.98715-25.99385-12.789568-11.094874-22.911656-24.590991-30.228027-40.350115-7.388049-15.815443-11.105113-33.658375-11.105113-53.661915L104.955866 300.370534 32.790548 300.370534c-0.814068-0.778228-1.162223-2.6982-1.162223-5.780393-0.819188-3.839942-1.167342-15.759124-1.167342-35.762664 0-9.99921 2.324445-21.160643 6.978455-33.489418 4.64889-12.287816 11.627346-23.659165 20.930246-34.00653 9.3029-10.413924 21.33984-19.076834 36.105698-25.99385 14.765859-6.917016 32.214557-10.372964 52.387054-10.372964l103.663085 0L250.525522 84.576011c0-20.02914 6.983575-37.150163 20.935366-51.398909 14.00811-14.218027 31.047214-21.33984 51.276031-21.33984l364.497573 0c27.150953 0 45.98715 7.121813 56.457393 21.33984 10.460003 14.243626 15.748884 31.36465 15.748884 51.398909l0 71.515087c16.286476 0.788468 33.724934 1.167342 52.381934 1.167342L865.392459 157.258441 865.392459 157.253321zM322.747159 157.253321l364.497573 0L687.244731 84.576011 322.747159 84.576011 322.747159 157.253321zM286.64658 887.815163c24.826508 0 37.267921-15.815443 37.267921-47.33369L323.914501 304.988705 251.697985 304.988705l0 535.492768c0 16.163598 2.498523 28.087899 7.557007 35.762664C264.318595 883.9701 273.442298 887.815163 286.64658 887.815163L286.64658 887.815163zM506.711119 886.65294c13.199162 0 22.153908-3.665865 26.807918-10.987355 4.64889-7.275411 6.968215-19.020515 6.968215-35.184112L540.487253 304.988705 468.275856 304.988705l0 535.492768C468.275856 871.241971 481.131983 886.65294 506.711119 886.65294L506.711119 886.65294zM725.679995 884.333615c13.956911 0 23.259811-3.609546 27.908701-10.941276 4.705209-7.32149 7.029655-19.066594 7.029655-35.230192L760.618351 304.988705l-73.373619 0 0 533.173442C687.249851 868.978965 700.039419 884.333615 725.679995 884.333615L725.679995 884.333615z" fill="#F97066"></path>
        </svg>
      </div>
      <div class="delete-task-content">
        <div class="delete-task-title">删除定时同步</div>
        <div class="delete-task-desc">仅移除该规则，不会删本地知识库。</div>
      </div>
    </div>
  `

  try {
    await ElMessageBox.confirm(html, '', {
      type: 'warning',
      dangerouslyUseHTMLString: true,
      customClass: 'delete-task-message-box',
      showClose: true,
      closeOnClickModal: false,
      showTitle: false,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'delete-task-confirm-btn',
      cancelButtonClass: 'delete-task-cancel-btn',
      center: false,
    })
  } catch {
    return
  }
  try {
    await $fetch(`/api/schedules/${row.id}`, { method: 'DELETE' })
    ElMessage.success('已删除')
    await loadSchedules()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '删除失败')
  }
}

async function refresh() {
  loading.value = true
  try {
    const res = await $fetch<{ tasks: any[] }>('/api/tasks')
    tasks.value = res.tasks || []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function cancel(id: string) {
  try {
    await $fetch(`/api/tasks/${id}/cancel`, { method: 'POST' })
    ElMessage.success('已取消')
    await refresh()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '取消失败')
  }
}

async function retry(id: string) {
  try {
    await $fetch(`/api/tasks/${id}/retry`, { method: 'POST' })
    ElMessage.success('已重试')
    await refresh()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '重试失败')
  }
}

let eventSource: EventSource | null = null

function stopLiveLogs() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  if (liveStatus.value !== 'idle') liveStatus.value = 'closed'
}

function startLiveLogs(id: string) {
  stopLiveLogs()
  if (typeof EventSource === 'undefined') {
    liveStatus.value = 'error'
    return
  }
  liveStatus.value = 'connecting'
  eventSource = new EventSource(`/api/tasks/${id}/events`)
  eventSource.onopen = () => {
    liveStatus.value = 'live'
  }
  eventSource.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data)
      if (!current.value || current.value.id !== id) return
      liveStatus.value = 'live'
      if (payload.type === 'task' && payload.task) {
        current.value = payload.task
        const idx = tasks.value.findIndex((t) => t.id === id)
        if (idx >= 0) tasks.value[idx] = payload.task
        if (['success', 'failed', 'cancelled'].includes(payload.task.status)) {
          stopLiveLogs()
        }
      } else if (payload.type === 'log' && payload.log) {
        const logs = current.value.logs ? [...current.value.logs] : []
        logs.push(payload.log)
        if (logs.length > 500) logs.splice(0, logs.length - 500)
        current.value = { ...current.value, logs }
      } else if (payload.type === 'progress') {
        current.value = {
          ...current.value,
          current: payload.current ?? current.value.current,
          total: payload.total ?? current.value.total,
          message: payload.message ?? current.value.message,
        }
      } else if (payload.type === 'done' && payload.task) {
        current.value = payload.task
        const idx = tasks.value.findIndex((t) => t.id === id)
        if (idx >= 0) tasks.value[idx] = payload.task
        stopLiveLogs()
      }
    } catch {
      // ignore malformed event
    }
  }
  eventSource.onerror = () => {
    if (!eventSource) return
    // EventSource will auto-reconnect while task still open
    if (current.value && ['success', 'failed', 'cancelled'].includes(current.value.status)) {
      stopLiveLogs()
      return
    }
    liveStatus.value = 'error'
  }
}

function onTaskMobileCommand(cmd: string, row: any) {
  if (cmd === 'cancel') void cancel(row.id)
  else if (cmd === 'retry') void retry(row.id)
  else if (cmd === 'delete') void remove(row)
}

function showDetail(row: any) {
  current.value = row
  drawer.value = true
  if (row?.status === 'running' || row?.status === 'queued') {
    startLiveLogs(row.id)
  } else {
    stopLiveLogs()
  }
}

async function remove(row: any) {
  const id = row?.id
  if (!id) return

  const html = `
    <div class="delete-task-dialog-body">
      <div class="delete-task-icon" aria-hidden="true">
        <svg viewBox="0 0 1024 1024" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
          <path d="M865.392459 157.253321c23.31613 0 42.500482 3.834822 57.675935 11.540307 15.119133 7.705484 27.161193 17.32582 36.049379 28.866127 8.954746 11.509587 15.175452 24.01756 18.66724 37.503437 3.486668 13.465398 5.227442 25.963131 5.227442 37.503437 0 5.411759-0.168957 9.620336-0.573431 12.702529-0.409594 3.051474-0.578551 5.785513-0.578551 8.053639l0 6.942616-76.865407 0 0 605.871232c0 15.416089-3.087314 30.238266-9.3029 44.481893-6.220707 14.187307-15.175452 26.746479-26.807918 37.503437-11.627346 10.751839-25.814653 19.414749-42.500482 25.922171-16.69095 6.579101-35.870182 9.830253-57.624736 9.830253L249.378659 1023.9744c-20.182737 0-39.193012-3.082194-57.102503-9.246581-17.842932-6.164388-33.131023-14.827298-45.98715-25.99385-12.789568-11.094874-22.911656-24.590991-30.228027-40.350115-7.388049-15.815443-11.105113-33.658375-11.105113-53.661915L104.955866 300.370534 32.790548 300.370534c-0.814068-0.778228-1.162223-2.6982-1.162223-5.780393-0.819188-3.839942-1.167342-15.759124-1.167342-35.762664 0-9.99921 2.324445-21.160643 6.978455-33.489418 4.64889-12.287816 11.627346-23.659165 20.930246-34.00653 9.3029-10.413924 21.33984-19.076834 36.105698-25.99385 14.765859-6.917016 32.214557-10.372964 52.387054-10.372964l103.663085 0L250.525522 84.576011c0-20.02914 6.983575-37.150163 20.935366-51.398909 14.00811-14.218027 31.047214-21.33984 51.276031-21.33984l364.497573 0c27.150953 0 45.98715 7.121813 56.457393 21.33984 10.460003 14.243626 15.748884 31.36465 15.748884 51.398909l0 71.515087c16.286476 0.788468 33.724934 1.167342 52.381934 1.167342L865.392459 157.258441 865.392459 157.253321zM322.747159 157.253321l364.497573 0L687.244731 84.576011 322.747159 84.576011 322.747159 157.253321zM286.64658 887.815163c24.826508 0 37.267921-15.815443 37.267921-47.33369L323.914501 304.988705 251.697985 304.988705l0 535.492768c0 16.163598 2.498523 28.087899 7.557007 35.762664C264.318595 883.9701 273.442298 887.815163 286.64658 887.815163L286.64658 887.815163zM506.711119 886.65294c13.199162 0 22.153908-3.665865 26.807918-10.987355 4.64889-7.275411 6.968215-19.020515 6.968215-35.184112L540.487253 304.988705 468.275856 304.988705l0 535.492768C468.275856 871.241971 481.131983 886.65294 506.711119 886.65294L506.711119 886.65294zM725.679995 884.333615c13.956911 0 23.259811-3.609546 27.908701-10.941276 4.705209-7.32149 7.029655-19.066594 7.029655-35.230192L760.618351 304.988705l-73.373619 0 0 533.173442C687.249851 868.978965 700.039419 884.333615 725.679995 884.333615L725.679995 884.333615z" fill="#F97066"></path>
        </svg>
      </div>
      <div class="delete-task-content">
        <div class="delete-task-title">删除任务</div>
        <div class="delete-task-desc">仅移除任务记录，不会删本地知识库。</div>
      </div>
    </div>
  `

  try {
    await ElMessageBox.confirm(html, '', {
      type: 'warning',
      dangerouslyUseHTMLString: true,
      customClass: 'delete-task-message-box',
      showClose: true,
      closeOnClickModal: false,
      showTitle: false,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'delete-task-confirm-btn',
      cancelButtonClass: 'delete-task-cancel-btn',
      center: false,
    })
  } catch {
    return
  }
  try {
    await $fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    ElMessage.success('已删除')
    if (current.value?.id === id) {
      drawer.value = false
      current.value = null
    }
    await refresh()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '删除失败')
  }
}

watch(drawer, (open) => {
  if (!open) stopLiveLogs()
})

const { prefs: uiPrefs } = useUiPrefs()
const autoRefresh = computed(() => uiPrefs.autoRefreshTasks !== false)

/**
 * 任务页高度：
 * - 定时同步表固定上限（行少收缩、行多表内滚，整卡不滚）
 * - 下载任务表按「页面底 − 表格顶 − 卡片底 padding」动态分配
 * - 定时同步增删会改变上卡片高度 → ResizeObserver / watch 自动重算
 */
const scheduleTableMaxHeight = ref(200)
const tasksTableMaxHeight = ref(360)
let _layoutRaf = 0
let _scheduleRo: ResizeObserver | null = null

function measureTasksTableMaxHeight() {
  if (!import.meta.client) return
  const page = document.querySelector('.tasks-page') as HTMLElement | null
  const tasksPanel = document.querySelector('.tasks-table-panel') as HTMLElement | null
  const tasksWrap = document.querySelector('.tasks-table-wrap') as HTMLElement | null
  if (!page || !tasksPanel || !tasksWrap) return

  // 手机端：整页滚动为主；下载任务表用适中 max-height（内部可再滚）
  if (isMobile.value || window.matchMedia('(max-width: 900px)').matches) {
    // 约 36vh，避免占满首屏导致“下面像没有内容”
    const next = Math.min(320, Math.max(180, Math.floor(window.innerHeight * 0.32)))
    if (tasksTableMaxHeight.value !== next) {
      tasksTableMaxHeight.value = next
    }
    const scrollWrap = tasksPanel.querySelector(
      '.el-table__body-wrapper .el-scrollbar__wrap',
    ) as HTMLElement | null
    const scrollable = !!(scrollWrap && scrollWrap.scrollHeight > scrollWrap.clientHeight + 1)
    tasksPanel.classList.toggle('is-scrollable', scrollable)
    return
  }

  const pageBottom = page.getBoundingClientRect().bottom
  const wrapTop = tasksWrap.getBoundingClientRect().top
  const padBottom = Number.parseFloat(getComputedStyle(tasksPanel).paddingBottom || '0') || 20
  // 如实使用剩余空间；不设硬性下限，避免矮屏被抬高溢出
  const next = Math.max(0, Math.floor(pageBottom - wrapTop - padBottom - 2))
  if (tasksTableMaxHeight.value !== next) {
    tasksTableMaxHeight.value = next
  }

  const scrollWrap = tasksPanel.querySelector(
    '.el-table__body-wrapper .el-scrollbar__wrap',
  ) as HTMLElement | null
  const scrollable = !!(scrollWrap && scrollWrap.scrollHeight > scrollWrap.clientHeight + 1)
  tasksPanel.classList.toggle('is-scrollable', scrollable)
}

function updateTasksTableMaxHeight() {
  if (!import.meta.client) return
  if (_layoutRaf) cancelAnimationFrame(_layoutRaf)
  nextTick(() => {
    _layoutRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        _layoutRaf = 0
        measureTasksTableMaxHeight()
      })
    })
  })
}

function bindScheduleResizeObserver() {
  if (!import.meta.client || typeof ResizeObserver === 'undefined') return
  const el = document.querySelector('.schedule-panel')
  if (!el) return
  _scheduleRo?.disconnect()
  // 上卡片高度变化（添加/删除定时同步）时重算下方表格
  _scheduleRo = new ResizeObserver(() => {
    updateTasksTableMaxHeight()
  })
  _scheduleRo.observe(el)
}

let timer: ReturnType<typeof setInterval> | null = null

function stopAutoRefresh() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  if (!autoRefresh.value) return
  timer = setInterval(() => {
    void refresh()
    void loadSchedules()
  }, 5000)
}

onMounted(async () => {
  syncMobileFlag()
  if (import.meta.client) {
    _mqMobile = window.matchMedia('(max-width: 900px)')
    const onMq = () => syncMobileFlag()
    // safari fallback
    if (_mqMobile.addEventListener) _mqMobile.addEventListener('change', onMq)
    else _mqMobile.addListener?.(onMq)
  }
  window.addEventListener('resize', updateTasksTableMaxHeight)
  updateDrawerSize()
  window.addEventListener('resize', updateDrawerSize)
  await refresh()
  await loadSchedules()
  startAutoRefresh()
  bindScheduleResizeObserver()
  updateTasksTableMaxHeight()
})

watch(autoRefresh, () => {
  startAutoRefresh()
})

watch(tasks, () => {
  updateTasksTableMaxHeight()
})

// 定时同步增删会改变上卡片高度，必须重算下载任务表 max-height
watch(
  () => schedules.value.length,
  () => {
    updateTasksTableMaxHeight()
  },
)

watch(
  schedules,
  () => {
    updateTasksTableMaxHeight()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  stopAutoRefresh()
  stopLiveLogs()
  if (import.meta.client) {
    window.removeEventListener('resize', updateTasksTableMaxHeight)
    window.removeEventListener('resize', updateDrawerSize)
    if (_mqMobile) {
      const onMq = () => syncMobileFlag()
      if (_mqMobile.removeEventListener) _mqMobile.removeEventListener('change', onMq)
      else _mqMobile.removeListener?.(onMq)
      _mqMobile = null
    }
  }
  _scheduleRo?.disconnect()
  _scheduleRo = null
})
</script>

<style scoped>
.tasks-page {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.tasks-page > .page-header {
  flex: 0 0 auto;
}

.schedule-panel {
  flex: 0 0 auto;
  margin-bottom: 0;
  max-height: none;
  overflow: visible;
}
.schedule-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
  align-items: center;
}
.schedule-form .schedule-url-input {
  flex: 1;
  min-width: 280px;
}
/* prepend 内嵌 select：统一外框 + 中间分隔线，边框要能看见 */
.schedule-form .schedule-interval-select {
  width: 108px;
  margin: 0;
}
.schedule-form :deep(.schedule-url-input.el-input-group) {
  /* 与全局 .el-input__wrapper 一致：var(--border-strong) */
  border: 1px solid var(--border-strong, #dfe3f0);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: none;
}
.schedule-form :deep(.schedule-url-input.el-input-group:focus-within) {
  border-color: rgba(49, 204, 121, 0.45);
  box-shadow: 0 0 0 4px rgba(49, 204, 121, 0.08);
}
.schedule-form :deep(.el-input-group__prepend) {
  background: #f5f7fa;
  padding: 0;
  box-shadow: none !important;
  border: none !important;
  border-right: 1px solid var(--border-strong, #dfe3f0) !important;
  overflow: hidden;
  border-radius: 0;
  width: 108px;
}
.schedule-form :deep(.schedule-url-input.el-input-group--prepend .el-input__wrapper) {
  border-radius: 0 !important;
  box-shadow: none !important;
  background: transparent !important;
}
.schedule-form :deep(.schedule-interval-select .el-select__wrapper) {
  width: 108px;
  min-height: 38px;
  height: 38px;
  box-shadow: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding: 0 12px;
}
.schedule-url {
  color: var(--text);
  text-decoration: none;
}
.schedule-url:hover {
  color: var(--primary);
  text-decoration: underline;
}
.task-url-cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-url-sep {
  margin: 0 4px;
  color: var(--text-secondary);
}
.schedule-error {
  font-size: 12px;
  color: #f04438;
  margin-top: 2px;
}

/* 两张卡片共用：标题栏 / 描述 / 圆角表格容器 */
.schedule-panel .panel-head,
.tasks-table-panel .panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
  min-height: 32px;
  flex: 0 0 auto;
}
.schedule-panel .panel-head .panel-title,
.tasks-table-panel .panel-head .panel-title {
  margin: 0;
}
.schedule-panel .panel-desc,
.tasks-table-panel .panel-desc {
  margin: 8px 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  flex: 0 0 auto;
}

.schedule-table-wrap,
.tasks-table-wrap {
  border: 1px solid var(--border-strong, #dfe3f0);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.schedule-panel :deep(.schedule-table),
.tasks-table-panel :deep(.tasks-table) {
  --el-table-border-color: var(--border-strong, #dfe3f0);
  --el-table-header-bg-color: #fafbfc;
  border: none !important;
}
/* EP border 表格伪元素会顶破圆角，关掉并交给外层 wrap 画边框 */
.schedule-panel :deep(.schedule-table.el-table--border::before),
.schedule-panel :deep(.schedule-table.el-table--border::after),
.schedule-panel :deep(.schedule-table.el-table--border .el-table__inner-wrapper::after),
.schedule-panel :deep(.schedule-table .el-table__inner-wrapper::before),
.schedule-panel :deep(.schedule-table .el-table__border-left-patch),
.tasks-table-panel :deep(.tasks-table.el-table--border::before),
.tasks-table-panel :deep(.tasks-table.el-table--border::after),
.tasks-table-panel :deep(.tasks-table.el-table--border .el-table__inner-wrapper::after),
.tasks-table-panel :deep(.tasks-table .el-table__inner-wrapper::before),
.tasks-table-panel :deep(.tasks-table .el-table__border-left-patch) {
  display: none !important;
}
.schedule-panel :deep(.schedule-table.el-table--border .el-table__cell),
.tasks-table-panel :deep(.tasks-table.el-table--border .el-table__cell) {
  border-right: 1px solid var(--border-strong, #dfe3f0);
}
.schedule-panel :deep(.schedule-table.el-table--border .el-table__cell:last-child),
.tasks-table-panel :deep(.tasks-table.el-table--border .el-table__cell:last-child) {
  border-right: none;
}
.schedule-panel :deep(.schedule-table .el-table__header-wrapper th.el-table__cell),
.tasks-table-panel :deep(.tasks-table .el-table__header-wrapper th.el-table__cell) {
  border-bottom: 1px solid var(--border-strong, #dfe3f0);
}
/*
 * 行分隔改用“上边框”而不是“下边框”：
 * 表格高度撑满、行数较少时，不会在最后一行下方空白区顶上留下一条悬空横线。
 */
.schedule-panel :deep(.schedule-table .el-table__body td.el-table__cell),
.tasks-table-panel :deep(.tasks-table .el-table__body td.el-table__cell) {
  border-bottom: none !important;
}
.schedule-panel :deep(.schedule-table .el-table__body tr:not(:first-child) > td.el-table__cell),
.tasks-table-panel :deep(.tasks-table .el-table__body tr:not(:first-child) > td.el-table__cell) {
  border-top: 1px solid var(--border-strong, #dfe3f0) !important;
}
.schedule-panel :deep(.schedule-table .el-table__body-wrapper),
.tasks-table-panel :deep(.tasks-table .el-table__body-wrapper) {
  border-bottom: none !important;
}

/*
 * 下载任务卡片：少行贴合内容；多行靠 max-height 表内滚动；底 padding 始终 20px
 */
.tasks-table-panel {
  flex: 0 0 auto;
  min-height: 0;
  margin-top: 16px !important;
  display: block;
  overflow: hidden;
  padding-bottom: 20px !important;
  box-sizing: border-box;
}
.tasks-table-wrap {
  display: block;
  position: relative;
  overflow: hidden;
}
.tasks-table-panel :deep(.tasks-table) {
  width: 100%;
}
.tasks-table-panel :deep(.tasks-table .el-table__body-wrapper) {
  overflow: hidden !important;
}
.tasks-table-panel.is-scrollable :deep(.tasks-table .el-table__body-wrapper .el-scrollbar__bar.is-vertical) {
  display: block !important;
  width: 8px !important;
  opacity: 1 !important;
  right: 2px;
}
.tasks-table-panel.is-scrollable :deep(.tasks-table .el-table__body-wrapper .el-scrollbar__bar.is-vertical .el-scrollbar__thumb) {
  background-color: rgba(144, 147, 153, 0.55) !important;
  border-radius: 999px;
  opacity: 1 !important;
}
.tasks-table-panel.is-scrollable :deep(.tasks-table .el-table__body-wrapper .el-scrollbar__bar.is-vertical .el-scrollbar__thumb:hover) {
  background-color: rgba(144, 147, 153, 0.8) !important;
}
.tasks-table-panel :deep(.tasks-table .el-table__body-wrapper .el-scrollbar__bar.is-horizontal) {
  display: none !important;
}

.status-tag {
  padding-inline: 4px;
}

.tasks-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 72px 16px 40px;
  color: var(--muted);
}

.tasks-empty-icon {
  display: block;
  margin-bottom: 2px;
}

.tasks-empty-title {
  font-size: 13px;
  font-weight: 500;
  color: #b0b6c6;
}

.detail-header {
  padding-right: 18px;
}

.detail-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.2;
}

.detail-summary {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 16px;
}

.detail-metric {
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(180deg, #f7fbf8 0%, #f3f7f5 100%);
  border: 1px solid rgba(49, 204, 121, 0.1);
}

.detail-metric-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}

.detail-metric-value {
  margin: 6px 0 10px;
  font-size: 24px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.02em;
}

.detail-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.detail-info-item {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8f9fc;
  border: 1px solid var(--border);
  min-width: 0;
}

.detail-info-label {
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-bottom: 4px;
}

.detail-info-value {
  font-size: 13px;
  color: var(--text);
  line-height: 1.45;
  word-break: break-word;
}

.detail-schedule-link {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.schedule-rule-url {
  font-size: 12px;
  color: var(--muted);
  word-break: break-all;
}

.detail-error {
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff5f5;
  border: 1px solid rgba(240, 68, 56, 0.12);
}

.detail-error-label {
  font-size: 12px;
  color: #f04438;
  font-weight: 700;
  margin-bottom: 4px;
}

.detail-error-text {
  font-size: 13px;
  color: #b42318;
  line-height: 1.5;
  word-break: break-word;
}

.detail-urls {
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8f9fc;
  border: 1px solid var(--border);
}

.detail-url-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.detail-url {
  color: var(--primary);
  font-size: 13px;
  text-decoration: none;
  word-break: break-all;
}

.detail-url:hover {
  text-decoration: underline;
}

.detail-log-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.detail-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.detail-log-live {
  font-size: 12px;
  color: var(--text-secondary);
}
.detail-log-live.live-live { color: #31cc79; }
.detail-log-live.live-connecting { color: #e6a23c; }
.detail-log-live.live-error { color: #f56c6c; }
.detail-log-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.detail-log-box {
  max-height: min(52vh, 460px);
  padding: 12px 14px;
}

.detail-log-line {
  display: grid;
  grid-template-columns: 148px 1fr;
  gap: 10px;
  padding: 4px 0;
  font-size: 12px;
  line-height: 1.5;
}

.detail-log-time {
  color: #8ea0c8;
  white-space: nowrap;
}

.detail-log-msg {
  word-break: break-word;
}

.detail-log-empty {
  color: #94a3b8;
  font-size: 12px;
  padding: 8px 0;
}
</style>

<style>
/* drawer teleport 到 body，需全局样式且提高优先级 */
.el-drawer.task-detail-drawer {
  border-radius: 18px 0 0 18px !important;
  overflow: hidden !important;
  background: #fbfcfe !important;
  box-shadow: -8px 0 28px rgba(28, 39, 76, 0.08);
}

.el-drawer.task-detail-drawer .el-drawer__header {
  margin-bottom: 0 !important;
  padding: 18px 18px 4px !important;
  border-bottom: none !important;
  background: #fbfcfe !important;
}

.el-drawer.task-detail-drawer .el-drawer__body {
  padding: 16px 18px 20px !important;
  background: #fbfcfe !important;
}


/* 删除任务确认弹窗 */
.delete-task-message-box.el-message-box {
  width: min(440px, calc(100vw - 32px));
  max-width: 440px;
  border-radius: 16px;
  padding-bottom: 16px;
  box-shadow: 0 20px 48px rgba(28, 39, 76, 0.14);
  border: 1px solid #eef1f7;
  overflow: hidden;
}
.delete-task-message-box .el-message-box__header { padding: 8px 12px 0; min-height: 0; }
.delete-task-message-box .el-message-box__title { display: none !important; }
.delete-task-message-box .el-message-box__headerbtn { top: 10px; right: 10px; }
.delete-task-message-box .el-message-box__status { display: none !important; }
.delete-task-message-box .el-message-box__content { padding: 12px 18px 4px; }
.delete-task-message-box .el-message-box__container { align-items: flex-start; }
.delete-task-message-box .el-message-box__message { width: 100%; padding-left: 0 !important; }
.delete-task-dialog-body { display:flex; gap:14px; align-items:flex-start; }
.delete-task-icon { width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:#fff1f0; border:1px solid rgba(249,112,102,0.18); flex-shrink:0; }
.delete-task-content { min-width:0; flex:1; }
.delete-task-title { font-size:17px; font-weight:700; color:#1b1f3b; line-height:1.4; margin-bottom:10px; }
.delete-task-desc { font-size:13px; color:#667085; line-height:1.55; margin-bottom:0; }
.delete-task-message-box .el-message-box__btns { padding:14px 18px 2px; gap:10px; }
.delete-task-message-box .el-message-box__btns .el-button { min-width:84px; border-radius:8px !important; font-weight:600; }
.delete-task-message-box .delete-task-cancel-btn { border-color:#d0d5dd; color:#475467; background:#fff; }
.delete-task-message-box .delete-task-cancel-btn:hover { border-color:#98a2b3; color:#1f2937; background:#f9fafb; }


.delete-task-message-box .delete-task-confirm-btn,
.delete-task-message-box .delete-task-confirm-btn:focus,
.delete-task-message-box .delete-task-confirm-btn.is-plain {
  background: #F56C6C !important;
  border-color: #F56C6C !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.35) !important;
}
.delete-task-message-box .delete-task-confirm-btn:hover,
.delete-task-message-box .delete-task-confirm-btn:active {
  background: #f45656 !important;
  border-color: #f45656 !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.45) !important;
}


/* mobile tasks */
@media (max-width: 900px) {
  .tasks-page {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    padding-bottom: 0;
  }

  .schedule-panel,
  .tasks-table-panel {
    max-height: none !important;
    overflow: visible !important;
  }

  /* 下载任务卡底部与页面底栏脱开 */
  .tasks-table-panel {
    margin-bottom: 4px !important;
    padding-bottom: 16px !important;
  }

  .schedule-form,
  .schedule-form.is-mobile {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .schedule-form .schedule-url-input {
    min-width: 0 !important;
    width: 100%;
  }

  .schedule-form > .el-button {
    width: 100%;
  }

  .schedule-interval-select-mobile {
    width: 100%;
  }

  .schedule-interval-select-mobile :deep(.el-select__wrapper) {
    min-height: 40px;
    border-radius: 12px;
  }

  .schedule-table-wrap,
  .tasks-table-wrap {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
  }

  /* 列已精简，不再强制 720 宽撑破页面 */
  .tasks-table-panel :deep(.tasks-table),
  .schedule-panel :deep(.schedule-table) {
    min-width: 0 !important;
    width: 100% !important;
  }

  .tasks-table-panel {
    overflow: visible;
  }

  .panel-desc {
    font-size: 12px;
    line-height: 1.55;
  }

  .task-url-cell {
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    word-break: break-all;
  }

  .task-meta-mobile {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .table-ops {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .table-ops.is-mobile :deep(.el-button) {
    margin: 0 !important;
    width: 100%;
    padding: 5px 8px;
  }

  .table-ops.is-mobile :deep(.el-button + .el-button) {
    margin-left: 0 !important;
  }

  .table-ops.is-mobile :deep(.el-dropdown) {
    width: 100%;
  }

  .table-ops.is-mobile :deep(.el-dropdown .el-button) {
    width: 100%;
  }

  .ops-caret {
    margin-left: 2px;
    font-size: 10px;
    opacity: 0.7;
  }

  .ops-danger {
    color: #f56c6c;
  }

  /* 固定操作列阴影轻一点 */
  .schedule-panel :deep(.el-table__fixed-right),
  .tasks-table-panel :deep(.el-table__fixed-right) {
    box-shadow: -6px 0 12px rgba(28, 39, 76, 0.06);
  }

  .schedule-panel :deep(.el-table__fixed-right-patch),
  .tasks-table-panel :deep(.el-table__fixed-right-patch) {
    background: #fff;
  }
}
</style>
