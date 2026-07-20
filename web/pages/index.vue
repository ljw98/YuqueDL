<template>
  <div class="page-fill" style="height:auto;min-height:100%;">
    <div class="page-header">
      <div>
        <h1>下载知识库</h1>
        <p>粘贴语雀链接，配置选项后即可开始。下载过程可实时查看进度与日志。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="label">当前模式</div>
        <div class="value" style="font-size:22px;">{{ modeLabel }}</div>
        <div class="hint">即时生效，无需额外确认</div>
      </div>
      <div class="stat-card">
        <div class="label">任务状态</div>
        <div class="value" style="font-size:22px;">{{ activeTask ? statusText(activeTask.status) : '空闲' }}</div>
        <div class="hint">{{ activeTask ? `${activeTask.current || 0}/${activeTask.total || 0}` : '等待创建任务' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">输出目录</div>
        <div class="value" style="font-size:18px;line-height:1.3;">data/downloads</div>
        <div class="hint">服务端统一托管</div>
      </div>
      <div class="stat-card">
        <div class="label">鉴权</div>
        <div class="value" style="font-size:22px;">{{ form.token || hasSavedToken ? '已配置' : '公开库' }}</div>
        <div class="hint">私有库请填写 Token</div>
      </div>
    </div>

    <div class="task-config-grid">
      <div class="panel task-config-card">
        <h3 class="panel-title">新建任务</h3>
        <el-form label-position="top" @submit.prevent>
          <el-form-item label="下载模式">
            <div class="mode-segmented">
              <el-segmented v-model="form.type" :options="[
                { label: '整库', value: 'book' },
                { label: '单/多文档', value: 'docs' },
                { label: '批量知识库', value: 'batch' },
                { label: '账号全部', value: 'user' },
              ]" />
            </div>
          </el-form-item>

          <el-form-item v-if="form.type !== 'user'" :label="urlLabel">
            <el-input
              v-model="form.urls"
              type="textarea"
              resize="none"
              :rows="3"
              :placeholder="urlPlaceholder"
            />
          </el-form-item>

          <el-form-item label="公开密码（如有）">
            <el-input v-model="form.password" type="password" show-password />
          </el-form-item>

          <el-button type="primary" size="large" round :loading="submitting" @click="startDownload">
            开始下载
          </el-button>
        </el-form>
      </div>

      <div class="panel task-config-card">
        <h3 class="panel-title">默认配置</h3>
        <p class="muted" style="margin:-6px 0 16px;">这里保存新任务的默认值，新建任务会直接使用。</p>
        <el-form label-position="top">
          <el-form-item label="语雀 Token">
            <el-input
              v-model="form.token"
              type="password"
              show-password
              :placeholder="hasSavedToken ? '已保存（输入新值可覆盖）' : '未设置'"
              @paste="onTokenPaste"
            />
          </el-form-item>
          <el-form-item label="Cookie Key">
            <el-input v-model="form.key" placeholder="_yuque_session" />
          </el-form-item>
          <el-form-item label="默认选项">
            <div class="option-chips">
              <el-checkbox v-model="form.ignoreImg" border>忽略图片</el-checkbox>
              <el-checkbox v-model="form.ignoreAttachments" border>忽略附件</el-checkbox>
              <el-checkbox v-model="form.incremental" border>增量下载</el-checkbox>
              <el-checkbox v-model="form.toc" border>生成 TOC</el-checkbox>
              <el-checkbox v-model="form.hideFooter" border>隐藏页脚</el-checkbox>
              <el-checkbox v-model="form.convertMarkdownVideoLinks" border>视频转 video</el-checkbox>
            </div>
          </el-form-item>
          <el-button type="primary" round :loading="saving" @click="saveSettings">保存设置</el-button>
        </el-form>
      </div>
    </div>

    <div v-if="activeTask" class="panel">
      <div class="task-head">
        <h3 class="panel-title" style="margin:0;">当前任务</h3>
        <div style="display:flex;gap:8px;align-items:center;">
          <el-tag :type="statusType(activeTask.status)" effect="light">{{ statusText(activeTask.status) }}</el-tag>
          <el-button
            v-if="activeTask.status === 'running' || activeTask.status === 'queued'"
            size="small"
            round
            @click="cancelActive"
          >
            取消
          </el-button>
          <el-button
            v-if="activeTask.status === 'success'"
            size="small"
            round
            type="primary"
            @click="goLibrary"
          >
            查看知识库
          </el-button>
        </div>
      </div>

      <el-progress
        :percentage="progressPercent"
        :stroke-width="10"
        :status="activeTask.status === 'failed' ? 'exception' : activeTask.status === 'success' ? 'success' : undefined"
      />
      <div class="progress-meta">
        <span>{{ activeTask.current || 0 }}/{{ activeTask.total || 0 }}</span>
        <span v-if="activeTask.message">{{ activeTask.message }}</span>
      </div>

      <div class="log-box" ref="logBoxRef">
        <div
          v-for="(line, idx) in logs"
          :key="idx"
          :class="`log-line-${line.level}`"
        >
          [{{ formatTime(line.ts) }}] {{ line.message }}
        </div>
        <div v-if="!logs.length" class="muted">等待日志…</div>
      </div>
    </div>

    <div v-if="activeTask" class="panel" style="text-align:center;padding:24px;">
      <el-button type="primary" round @click="navigateTo('/tasks')">
        前往任务中心查看详情
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
const form = reactive({
  type: 'book' as 'book' | 'docs' | 'batch' | 'user',
  urls: '',
  token: '',
  key: '',
  password: '',
  ignoreImg: false,
  ignoreAttachments: false,
  incremental: false,
  toc: false,
  hideFooter: false,
  convertMarkdownVideoLinks: false,
})

const submitting = ref(false)
const activeTask = ref<any>(null)
const logs = ref<Array<{ ts: number; level: string; message: string }>>([])
const logBoxRef = ref<HTMLElement | null>(null)
const hasSavedToken = ref(false)
const saving = ref(false)
let es: EventSource | null = null

const modeLabel = computed(() => ({
  book: '整库下载',
  docs: '文档下载',
  batch: '批量知识库',
  user: '账号全部',
}[form.type]))

const urlLabel = computed(() => {
  if (form.type === 'docs') return '文档 URL（每行一个）'
  if (form.type === 'batch') return '知识库 URL（每行一个）'
  return '知识库 URL'
})

const urlPlaceholder = computed(() => {
  if (form.type === 'docs') return 'https://www.yuque.com/xxx/yyy/doc1\nhttps://www.yuque.com/xxx/yyy/doc2'
  if (form.type === 'batch') return 'https://www.yuque.com/xxx/book1\nhttps://www.yuque.com/xxx/book2'
  return 'https://www.yuque.com/xxx/yyy'
})

const progressPercent = computed(() => {
  const t = activeTask.value
  if (!t || !t.total) return t?.status === 'success' ? 100 : 0
  return Math.min(100, Math.round((t.current / t.total) * 100))
})

function statusText(s: string) {
  return ({ queued: '排队中', running: '下载中', success: '成功', failed: '失败', cancelled: '已取消' } as any)[s] || s
}
function statusType(s: string) {
  return ({ queued: 'info', running: '', success: 'success', failed: 'danger', cancelled: 'warning' } as any)[s] || 'info'
}
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString()
}

function scrollLog() {
  nextTick(() => {
    if (logBoxRef.value) logBoxRef.value.scrollTop = logBoxRef.value.scrollHeight
  })
}

function closeEs() {
  if (es) {
    es.close()
    es = null
  }
}

function watchTask(id: string) {
  closeEs()
  es = new EventSource(`/api/tasks/${id}/events`)
  es.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data)
      if (data.type === 'task' || data.type === 'done') {
        activeTask.value = data.task
      } else if (data.type === 'progress') {
        if (activeTask.value) {
          activeTask.value.current = data.current
          activeTask.value.total = data.total
          activeTask.value.message = data.message
        }
      } else if (data.type === 'log') {
        logs.value.push(data.log)
        if (logs.value.length > 400) logs.value = logs.value.slice(-400)
        scrollLog()
      }
    } catch {
      // ignore
    }
  }
  es.onerror = () => {
    if (activeTask.value && ['success', 'failed', 'cancelled'].includes(activeTask.value.status)) {
      closeEs()
    }
  }
}

async function loadSettingsDefaults() {
  try {
    const res = await $fetch<{ settings: any }>('/api/settings')
    const s = res.settings || {}
    form.ignoreImg = Boolean(s.ignoreImg)
    form.ignoreAttachments = Boolean(s.ignoreAttachments)
    form.incremental = Boolean(s.incremental)
    form.toc = Boolean(s.toc)
    form.hideFooter = Boolean(s.hideFooter)
    form.convertMarkdownVideoLinks = Boolean(s.convertMarkdownVideoLinks)
    form.key = s.key || ''
    hasSavedToken.value = Boolean(s.hasToken)
  } catch {
    // ignore
  }
}

async function startDownload() {
  submitting.value = true
  try {
    const options: Record<string, any> = {
      ignoreImg: form.ignoreImg,
      ignoreAttachments: form.ignoreAttachments,
      incremental: form.incremental,
      toc: form.toc,
      hideFooter: form.hideFooter,
      convertMarkdownVideoLinks: form.convertMarkdownVideoLinks,
    }
    if (form.token) options.token = form.token
    if (form.key) options.key = form.key
    if (form.password) options.password = form.password

    const res = await $fetch<{ task: any }>('/api/tasks', {
      method: 'POST',
      body: {
        type: form.type,
        urls: form.urls,
        options,
      },
    })
    activeTask.value = res.task
    logs.value = res.task.logs || []
    watchTask(res.task.id)
    ElMessage.success('任务已创建')
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

async function cancelActive() {
  if (!activeTask.value?.id) return
  try {
    const res = await $fetch<{ task: any }>(`/api/tasks/${activeTask.value.id}/cancel`, { method: 'POST' })
    activeTask.value = res.task
    ElMessage.success('已发送取消')
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '取消失败')
  }
}

function goLibrary() {
  navigateTo('/library')
}

async function saveSettings() {
  saving.value = true
  try {
    const body: any = {
      key: form.key,
      ignoreImg: form.ignoreImg,
      ignoreAttachments: form.ignoreAttachments,
      incremental: form.incremental,
      toc: form.toc,
      hideFooter: form.hideFooter,
      convertMarkdownVideoLinks: form.convertMarkdownVideoLinks,
    }
    if (form.token) body.token = form.token
    const res = await $fetch('/api/settings', { method: 'PUT', body })
    hasSavedToken.value = Boolean((res as any).settings?.hasToken)
    if (form.token) form.token = ''
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function onTokenPaste(e: ClipboardEvent) {
  const raw = e.clipboardData?.getData('text') || ''
  if (!raw) return
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    const match = line.match(/_yuque_session[=\s]([^\s;]+)/)
    if (match) {
      form.token = match[1]
      e.preventDefault()
      ElMessage.success('已自动识别 Token')
      return
    }
  }
  const trimmed = raw.trim()
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    form.token = trimmed
    e.preventDefault()
    ElMessage.success('已自动识别 Token')
  }
}

onMounted(loadSettingsDefaults)
onBeforeUnmount(closeEs)
</script>

<style scoped>
.mode-segmented :deep(.el-segmented) {
  --el-segmented-item-selected-color: #fff;
  --el-segmented-item-selected-bg-color: #31cc79;
  --el-border-radius-base: 16px;
}
.mode-segmented :deep(.el-segmented__item) {
  height: 32px;
  line-height: 32px;
  padding: 0 16px;
}
.mode-segmented :deep(.el-segmented__item.is-selected) {
  color: #fff;
}
.task-config-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  width: 100%;
}
.task-config-card {
  min-width: 0;
}
.task-config-card .option-chips {
  gap: 8px;
}
.task-config-card .el-form-item {
  margin-bottom: 18px;
}
.task-config-card .el-form-item:last-of-type {
  margin-bottom: 0;
}
@media (max-width: 1100px) {
  .task-config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
