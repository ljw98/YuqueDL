<template>
  <div class="page-fill" style="height:auto;min-height:100%;">
    <div class="page-header">
      <div>
        <h1>下载知识库</h1>
        <p>粘贴语雀链接，配置选项后即可开始。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="label">当前模式</div>
        <div class="value" style="font-size:22px;">{{ modeLabel }}</div>
        <div class="hint">切换后立即生效</div>
      </div>
      <div class="stat-card">
        <div class="label">任务状态</div>
        <div class="value" style="font-size:22px;">{{ activeTask ? statusText(activeTask.status) : '空闲' }}</div>
        <div class="hint">{{ activeTask ? `${activeTask.current || 0}/${activeTask.total || 0}` : '暂无进行中任务' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">知识库</div>
        <div class="value" style="font-size:22px;">{{ libraryCount }}</div>
        <div class="hint">本地已下载数量</div>
      </div>
      <div class="stat-card">
        <div class="label">鉴权</div>
        <div class="value" style="font-size:22px;">{{ form.token || hasSavedToken ? '已配置' : '未配置' }}</div>
        <div class="hint">私有库需 Token</div>
      </div>
    </div>

    <div class="task-config-grid">
      <div ref="newTaskCardRef" class="panel task-config-card">
        <h3 class="panel-title">新建任务</h3>
        <div class="task-card-body">
          <el-form label-position="top" @submit.prevent>
            <el-form-item label="访问类型">
              <div class="mode-segmented">
                <el-segmented
                  v-model="accessType"
                  :options="accessTypeOptions"
                  :disabled="form.type === 'user'"
                />
              </div>
            </el-form-item>

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

            <!-- 公开：可选阅读密码，不需要 Token -->
            <el-form-item v-if="accessType === 'public'" label="访问密码">
              <div class="password-input-wrap">
                <el-input
                  v-model="form.password"
                  type="password"
                  show-password
                  size="large"
                  placeholder="有阅读密码时填写，没有则留空"
                />
              </div>
            </el-form-item>

            <!-- 私有：展示 Token 状态，引导去右侧配置 -->
            <el-form-item v-else label="语雀 Token">
              <div class="token-status-box" :class="tokenReady ? 'is-ready' : 'is-missing'">
                <div class="token-status-main">
                  <span class="token-status-label">{{ tokenReady ? '已配置' : '未配置' }}</span>
                  <span class="token-status-meta">{{ tokenStatusMeta }}</span>
                </div>
                <div class="field-hint" style="margin-top:8px;">
                  请在右侧「Token 设置」填写并保存，也可临时粘贴后直接下载。
                </div>
              </div>
            </el-form-item>
          </el-form>
        </div>
        <div class="task-card-footer">
          <div class="action-btn-wrap">
            <el-button class="action-btn" type="primary" size="large" round :loading="submitting" @click="startDownload">
              开始下载
            </el-button>
          </div>
        </div>
      </div>

      <div ref="settingsCardRef" class="panel task-config-card">
        <h3 class="panel-title">Token 设置</h3>
        <p class="panel-desc">
          登录语雀后按 F12 打开开发者工具 → Application → Cookies → <code>https://www.yuque.com</code> → 复制 <code>_yuque_session</code> 的 Value。
        </p>
        <div class="task-card-body">
          <el-form label-position="top">
            <el-form-item label="语雀 Token">
              <el-input
                v-model="form.token"
                type="password"
                show-password
                size="large"
                :placeholder="tokenPlaceholder"
                @paste="onTokenPaste"
              />
            </el-form-item>
            <el-form-item label="Cookie Key">
              <div class="password-input-wrap">
                <el-input v-model="form.key" size="large" placeholder="_yuque_session" />
              </div>
            </el-form-item>
            <el-form-item label="默认选项">
              <div class="option-chips">
                <el-tooltip content="跳过图片下载，正文保留原图链接" placement="top">
                  <el-checkbox v-model="form.ignoreImg" border>忽略图片</el-checkbox>
                </el-tooltip>
                <el-tooltip content="跳过所有附件与音视频；若只要忽略部分类型，请关闭并填写下方后缀" placement="top">
                  <el-checkbox v-model="form.ignoreAllAttachments" border>忽略附件</el-checkbox>
                </el-tooltip>
                <el-tooltip content="只下载有变更的文档，适合反复同步同一库" placement="top">
                  <el-checkbox v-model="form.incremental" border>增量下载</el-checkbox>
                </el-tooltip>
                <el-tooltip content="在 Markdown 顶部生成目录" placement="top">
                  <el-checkbox v-model="form.toc" border>生成 TOC</el-checkbox>
                </el-tooltip>
                <el-tooltip content="不在文末写入更新时间、原文链接等" placement="top">
                  <el-checkbox v-model="form.hideFooter" border>隐藏页脚</el-checkbox>
                </el-tooltip>
                <el-tooltip content="把视频链接写成 video 标签，方便本地预览" placement="top">
                  <el-checkbox v-model="form.convertMarkdownVideoLinks" border>视频改标签</el-checkbox>
                </el-tooltip>
              </div>
            </el-form-item>
            <el-form-item v-if="!form.ignoreAllAttachments" label="忽略附件后缀">
              <div class="password-input-wrap">
                <el-input
                  v-model="form.ignoreAttachmentExts"
                  size="large"
                  placeholder="例如 mp4,pdf,zip（留空则下载全部）"
                />
              </div>
            </el-form-item>
          </el-form>
        </div>
        <div class="task-card-footer">
          <div class="action-btn-wrap">
            <el-button class="action-btn" type="primary" size="large" round :loading="saving" @click="saveSettings">保存设置</el-button>
          </div>
        </div>
      </div>
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
  ignoreAllAttachments: false,
  ignoreAttachmentExts: '',
  incremental: false,
  toc: false,
  hideFooter: false,
  convertMarkdownVideoLinks: false,
})

/** 访问类型：公开库不需要 Token；私有库需要。账号全部强制私有 */
const accessType = ref<'public' | 'private'>('public')
const accessTypeOptions = [
  { label: '公开', value: 'public' },
  { label: '私有', value: 'private' },
]

const submitting = ref(false)
const activeTask = ref<any>(null)
const newTaskCardRef = ref<HTMLElement | null>(null)
const settingsCardRef = ref<HTMLElement | null>(null)
const hasSavedToken = ref(false)
const savedTokenHint = ref("")
const libraryCount = ref(0)
const tokenPlaceholder = computed(() => {
  if (hasSavedToken.value && savedTokenHint.value) return savedTokenHint.value
  if (hasSavedToken.value) return "已保存，输入新值可覆盖"
  return "未设置"
})
const saving = ref(false)

const tokenReady = computed(() => Boolean(form.token || hasSavedToken.value))
const tokenStatusMeta = computed(() => {
  if (form.token) return '将使用本次输入的 Token'
  if (hasSavedToken.value) return savedTokenHint.value || '将使用已保存的 Token'
  return '请先在右侧配置'
})
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

function statusText(s: string) {
  return ({ queued: '排队中', running: '下载中', success: '成功', failed: '失败', cancelled: '已取消' } as any)[s] || s
}

function syncCardHeights() {
  nextTick(() => {
    const left = newTaskCardRef.value
    const right = settingsCardRef.value
    if (!left || !right) return
    if (window.innerWidth <= 1100) {
      left.style.minHeight = ''
      right.style.minHeight = ''
      return
    }
    left.style.minHeight = ''
    right.style.minHeight = ''
    const height = Math.max(left.offsetHeight, right.offsetHeight)
    left.style.minHeight = `${height}px`
    right.style.minHeight = `${height}px`
  })
}


function parseIgnoreAttachments(value: unknown) {
  if (value === true) {
    form.ignoreAllAttachments = true
    form.ignoreAttachmentExts = ''
    return
  }
  form.ignoreAllAttachments = false
  if (typeof value === 'string' && value.trim()) {
    form.ignoreAttachmentExts = value
      .split(/[,，\s]+/)
      .map((part) => part.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean)
      .join(',')
    return
  }
  form.ignoreAttachmentExts = ''
}

function buildIgnoreAttachments(): boolean | string {
  if (form.ignoreAllAttachments) return true
  const cleaned = form.ignoreAttachmentExts
    .split(/[,，\s]+/)
    .map((part) => part.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean)
  return cleaned.length ? cleaned.join(',') : false
}

async function loadSettingsDefaults() {
  try {
    const res = await $fetch<{ settings: any }>('/api/settings')
    const s = res.settings || {}
    form.ignoreImg = Boolean(s.ignoreImg)
    parseIgnoreAttachments(s.ignoreAttachments)
    form.incremental = Boolean(s.incremental)
    form.toc = Boolean(s.toc)
    form.hideFooter = Boolean(s.hideFooter)
    form.convertMarkdownVideoLinks = Boolean(s.convertMarkdownVideoLinks)
    form.key = s.key || ''
    hasSavedToken.value = Boolean(s.hasToken)
    savedTokenHint.value = s.hasToken && s.token && String(s.token).includes("****")
      ? String(s.token)
      : (s.hasToken ? "••••••••••••" : "")
  } catch {
    // ignore
  }
}

async function loadLibraryCount() {
  try {
    const res = await $fetch<{ books: any[] }>('/api/library')
    libraryCount.value = Array.isArray(res.books) ? res.books.length : 0
  } catch {
    libraryCount.value = 0
  }
}

async function startDownload() {
  if (form.type !== 'user' && !String(form.urls || '').trim()) {
    ElMessage.warning('请先填写知识库或文档 URL')
    return
  }
  if (accessType.value === 'private' && !tokenReady.value) {
    ElMessage.warning('私有库需要语雀 Token，请先在右侧填写')
    return
  }

  submitting.value = true
  try {
    const options: Record<string, any> = {
      ignoreImg: form.ignoreImg,
      ignoreAttachments: buildIgnoreAttachments(),
      incremental: form.incremental,
      toc: form.toc,
      hideFooter: form.hideFooter,
      convertMarkdownVideoLinks: form.convertMarkdownVideoLinks,
    }

    if (accessType.value === 'private') {
      // 私有：使用本次 Token 或落盘已保存 Token（后端 createTask 会回落 settings.token）
      if (form.token) options.token = form.token
      if (form.key) options.key = form.key
    } else {
      // 公开：显式清空 token，避免后端回落到已保存的私有 Token
      options.token = ''
      if (form.password) options.password = form.password
    }

    const res = await $fetch<{ task: any }>('/api/tasks', {
      method: 'POST',
      body: {
        type: form.type,
        urls: form.urls,
        options,
      },
    })
    activeTask.value = res.task
    syncCardHeights()
    ElMessage.success('任务已创建，请到「任务」页查看')
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const body: any = {
      key: form.key,
      ignoreImg: form.ignoreImg,
      ignoreAttachments: buildIgnoreAttachments(),
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
    ElMessage.error(e?.data?.statusMessage || e?.message || '保存失败')
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

watch(() => form.type, (type) => {
  // 账号全部必须登录态
  if (type === 'user') accessType.value = 'private'
  syncCardHeights()
})
watch(accessType, (val) => {
  if (val === 'private') form.password = ''
  syncCardHeights()
})

onMounted(() => {
  loadSettingsDefaults()
  loadLibraryCount()
  syncCardHeights()
  window.addEventListener('resize', syncCardHeights)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncCardHeights)
})
</script>

<style scoped>
.panel-desc {
  margin: -6px 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
/* 全局 code 标签样式只挂在 .md-preview 下，这里补一份可见的行内 code */
.panel-desc code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: #e8f9f0;
  color: #2db86e;
  padding: 0.22em 0.55em;
  border-radius: 6px;
}
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
  align-items: stretch;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  width: 100%;
}
.task-config-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.task-card-body {
  flex: 1;
}
.task-config-card .el-form {
  display: flex;
  flex-direction: column;
  height: 100%;
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
.task-card-footer {
  margin-top: auto;
  padding-top: 16px;
}
.action-btn-wrap {
  margin-top: 0;
}
.password-input-wrap {
  width: 300px;
  max-width: 100%;
}
.password-input-wrap :deep(.el-input) {
  width: 100%;
}
.action-btn {
  width: 120px;
  height: 40px;
  line-height: 40px;
  padding-top: 0;
  padding-bottom: 0;
}
@media (max-width: 1100px) {
  .task-config-grid {
    grid-template-columns: 1fr;
  }
  .task-config-card {
    height: auto;
  }
  .task-config-card .el-form {
    height: auto;
  }
  .task-card-footer {
    margin-top: 0;
  }
}
.option-chips :deep(.el-tooltip__trigger) {
  display: inline-flex;
}
.field-hint {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.token-status-box {
  width: 100%;
  border: 1px solid var(--border-strong, #dfe3f0);
  border-radius: 12px;
  padding: 12px 14px;
  background: #fafbfc;
}
.token-status-box.is-ready {
  border-color: rgba(49, 204, 121, 0.45);
  background: #f3fbf6;
}
.token-status-box.is-missing {
  border-color: rgba(230, 162, 60, 0.45);
  background: #fffaf0;
}
.token-status-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
}
.token-status-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1f2329);
}
.token-status-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 480px) {
  .stat-row {
    grid-template-columns: 1fr;
  }
  .mode-segmented :deep(.el-segmented__item) {
    padding: 0 10px;
  }
}
</style>
