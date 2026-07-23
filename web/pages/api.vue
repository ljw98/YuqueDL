<template>
  <div class="page-fill" style="height:auto;min-height:100%;">
    <div class="page-header">
      <div>
        <h1>接口</h1>
        <p>生成 API Token，对接 Open API 或 MCP。</p>
      </div>
    </div>

    <div class="api-grid">
      <div class="panel">
        <h3 class="panel-title">API Token</h3>
        <p class="panel-desc">
          Token 仅生成时显示一次，请复制保存好。
        </p>

        <div class="token-box">
          <div class="token-row">
            <span class="token-label">当前</span>
            <code class="token-value">{{ status.configured ? (status.hint || '已配置') : '未生成' }}</code>
          </div>
          <div v-if="status.createdAt" class="token-row">
            <span class="token-label">生成时间</span>
            <span class="token-meta">{{ formatTime(status.createdAt) }}</span>
          </div>
        </div>

        <div v-if="freshToken" class="fresh-token">
          <div class="fresh-title">新 Token（仅显示一次）</div>
          <div class="fresh-body">
            <code>{{ freshToken }}</code>
            <el-button size="small" type="primary" @click="copyText(freshToken)">复制</el-button>
          </div>
        </div>

        <div class="token-actions">
          <el-button
            :type="status.configured ? 'warning' : 'primary'"
            :loading="generating"
            @click="generateToken"
          >
            {{ status.configured ? '重新生成' : '生成 Token' }}
          </el-button>
          <el-button
            type="danger"
            plain
            :disabled="!status.configured"
            :loading="revoking"
            @click="revokeToken"
          >
            删除
          </el-button>
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">快速接入</h3>
        <p class="panel-desc">将 Base URL 与 Token 填入客户端或脚本即可。</p>

        <div class="field-block">
          <div class="field-label">Base URL</div>
          <div class="code-line">
            <code>{{ baseUrl }}</code>
            <el-button class="copy-btn" size="small" plain @click="copyText(baseUrl)">复制</el-button>
          </div>
        </div>

        <div class="field-block">
          <div class="field-label">MCP 端点</div>
          <div class="code-line">
            <code>{{ mcpUrl }}</code>
            <el-button class="copy-btn" size="small" plain @click="copyText(mcpUrl)">复制</el-button>
          </div>
        </div>

        <div class="field-block">
          <div class="field-label">请求头</div>
          <pre class="code-block">Authorization: Bearer &lt;YOUR_API_TOKEN&gt;</pre>
        </div>

        <div class="field-block">
          <div class="field-label">MCP 客户端配置示例</div>
          <pre class="code-block">{{ mcpConfigSample }}</pre>
        </div>
      </div>
    </div>

    <div class="docs-stack">
      <div class="panel docs-panel">
        <div class="docs-head">
          <h3 class="panel-title">REST 接口</h3>
          <span class="docs-count">{{ apiRows.length }} 个</span>
        </div>
        <div class="endpoint-list">
          <div v-for="row in apiRows" :key="row.method + row.path" class="endpoint-item">
            <el-tag :type="methodType(row.method)" effect="light">
              {{ row.method }}
            </el-tag>
            <code class="path-code" :title="row.path">{{ row.path }}</code>
            <div class="endpoint-desc">{{ row.desc }}</div>
          </div>
        </div>
      </div>

      <div class="panel docs-panel">
        <div class="docs-head">
          <h3 class="panel-title">MCP Tools</h3>
          <span class="docs-count">{{ mcpTools.length }} 个</span>
        </div>
        <div class="endpoint-list tools-list">
          <div v-for="row in mcpTools" :key="row.name" class="endpoint-item tool-item">
            <code class="path-code" :title="row.name">{{ row.name }}</code>
            <div class="endpoint-desc">{{ row.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel" style="margin-top:16px;">
      <h3 class="panel-title">调用示例</h3>
      <el-tabs v-model="exampleTab">
        <el-tab-pane label="创建任务" name="create">
          <pre class="code-block">{{ createExample }}</pre>
        </el-tab-pane>
        <el-tab-pane label="查询任务" name="list">
          <pre class="code-block">{{ listExample }}</pre>
        </el-tab-pane>
        <el-tab-pane label="MCP 工具调用" name="mcp">
          <pre class="code-block">{{ mcpCallExample }}</pre>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
const loading = ref(false)
const generating = ref(false)
const revoking = ref(false)
const freshToken = ref('')
const exampleTab = ref('create')
const status = reactive({
  configured: false,
  hint: '',
  createdAt: null as number | null,
})

const origin = computed(() => {
  if (import.meta.client) return window.location.origin
  return 'http://localhost:8787'
})
const baseUrl = computed(() => origin.value)
const mcpUrl = computed(() => `${origin.value}/api/mcp`)

const mcpConfigSample = computed(() =>
  JSON.stringify(
    {
      mcpServers: {
        'yuque-dl': {
          url: mcpUrl.value,
          headers: {
            Authorization: 'Bearer <YOUR_API_TOKEN>',
          },
        },
      },
    },
    null,
    2,
  ),
)

const apiRows = [
  { method: 'GET', path: '/api/open/status', desc: '服务状态与统计' },
  { method: 'GET', path: '/api/open/tasks', desc: '任务列表（?status=&limit=）' },
  { method: 'POST', path: '/api/open/tasks', desc: '创建下载任务' },
  { method: 'GET', path: '/api/open/tasks/:id', desc: '任务详情' },
  { method: 'POST', path: '/api/open/tasks/:id/cancel', desc: '取消任务' },
  { method: 'POST', path: '/api/open/tasks/:id/retry', desc: '重试任务' },
  { method: 'GET', path: '/api/open/library', desc: '已下载知识库列表' },
  { method: 'GET', path: '/api/open/library/:book/export', desc: '导出知识库 ZIP（流式）' },
  { method: 'GET/POST', path: '/api/mcp', desc: 'MCP JSON-RPC 端点' },
]

const mcpTools = [
  { name: 'yuque_status', desc: '服务状态' },
  { name: 'yuque_list_tasks', desc: '列出任务' },
  { name: 'yuque_get_task', desc: '任务详情' },
  { name: 'yuque_create_task', desc: '创建下载任务' },
  { name: 'yuque_cancel_task', desc: '取消任务' },
  { name: 'yuque_retry_task', desc: '重试任务' },
  { name: 'yuque_list_books', desc: '已下载知识库' },
  { name: 'yuque_export_book', desc: '导出知识库 ZIP' },
]

const createExample = computed(
  () => `curl -X POST '${baseUrl.value}/api/open/tasks' \\
  -H 'Authorization: Bearer <YOUR_API_TOKEN>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "type": "book",
    "urls": ["https://www.yuque.com/user/book"],
    "options": { "ignoreImg": false, "toc": true }
  }'`,
)

const listExample = computed(
  () => `curl '${baseUrl.value}/api/open/tasks?limit=20' \\
  -H 'Authorization: Bearer <YOUR_API_TOKEN>'`,
)

const mcpCallExample = computed(
  () => `curl -X POST '${mcpUrl.value}' \\
  -H 'Authorization: Bearer <YOUR_API_TOKEN>' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "yuque_create_task",
      "arguments": {
        "type": "book",
        "urls": ["https://www.yuque.com/user/book"]
      }
    }
  }'`,
)

function methodType(m: string) {
  if (m.startsWith('GET')) return 'success'
  if (m.startsWith('POST')) return 'warning'
  return 'info'
}

function formatTime(ts?: number | null) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}

async function copyText(text: string) {
  const value = String(text || '')
  if (!value) {
    ElMessage.warning('没有可复制的内容')
    return
  }

  // Prefer Clipboard API when available (secure context)
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value)
      ElMessage.success('已复制')
      return
    }
  } catch {
    // fall through to legacy path
  }

  // Fallback: temporary textarea + execCommand (works over plain HTTP / non-localhost)
  try {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', 'true')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.padding = '0'
    ta.style.border = 'none'
    ta.style.outline = 'none'
    ta.style.boxShadow = 'none'
    ta.style.background = 'transparent'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (ok) {
      ElMessage.success('已复制')
      return
    }
  } catch {
    // ignore
  }

  ElMessage.error('复制失败，请手动选择文本')
}

async function refresh() {
  loading.value = true
  try {
    const res = await $fetch<{ configured: boolean; hint: string; createdAt: number | null }>(
      '/api/open/token',
    )
    status.configured = Boolean(res.configured)
    status.hint = res.hint || ''
    status.createdAt = res.createdAt || null
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function confirmDialogHtml(title: string, desc: string, tone: 'warning' | 'danger' = 'warning') {
  const iconBg = tone === 'danger' ? '#fff1f0' : '#fff7e8'
  const iconBorder = tone === 'danger' ? 'rgba(249,112,102,0.18)' : 'rgba(230,162,60,0.22)'
  const iconFill = tone === 'danger' ? '#F97066' : '#E6A23C'
  const iconPath = tone === 'danger'
    ? 'M865.392459 157.253321c23.31613 0 42.500482 3.834822 57.675935 11.540307 15.119133 7.705484 27.161193 17.32582 36.049379 28.866127 8.954746 11.509587 15.175452 24.01756 18.66724 37.503437 3.486668 13.465398 5.227442 25.963131 5.227442 37.503437 0 5.411759-0.168957 9.620336-0.573431 12.702529-0.409594 3.051474-0.578551 5.785513-0.578551 8.053639l0 6.942616-76.865407 0 0 605.871232c0 15.416089-3.087314 30.238266-9.3029 44.481893-6.220707 14.187307-15.175452 26.746479-26.807918 37.503437-11.627346 10.751839-25.814653 19.414749-42.500482 25.922171-16.69095 6.579101-35.870182 9.830253-57.624736 9.830253L249.378659 1023.9744c-20.182737 0-39.193012-3.082194-57.102503-9.246581-17.842932-6.164388-33.131023-14.827298-45.98715-25.99385-12.789568-11.094874-22.911656-24.590991-30.228027-40.350115-7.388049-15.815443-11.105113-33.658375-11.105113-53.661915L104.955866 300.370534 32.790548 300.370534c-0.814068-0.778228-1.162223-2.6982-1.162223-5.780393-0.819188-3.839942-1.167342-15.759124-1.167342-35.762664 0-9.99921 2.324445-21.160643 6.978455-33.489418 4.64889-12.287816 11.627346-23.659165 20.930246-34.00653 9.3029-10.413924 21.33984-19.076834 36.105698-25.99385 14.765859-6.917016 32.214557-10.372964 52.387054-10.372964l103.663085 0L250.525522 84.576011c0-20.02914 6.983575-37.150163 20.935366-51.398909 14.00811-14.218027 31.047214-21.33984 51.276031-21.33984l364.497573 0c27.150953 0 45.98715 7.121813 56.457393 21.33984 10.460003 14.243626 15.748884 31.36465 15.748884 51.398909l0 71.515087c16.286476 0.788468 33.724934 1.167342 52.381934 1.167342L865.392459 157.258441 865.392459 157.253321zM322.747159 157.253321l364.497573 0L687.244731 84.576011 322.747159 84.576011 322.747159 157.253321zM286.64658 887.815163c24.826508 0 37.267921-15.815443 37.267921-47.33369L323.914501 304.988705 251.697985 304.988705l0 535.492768c0 16.163598 2.498523 28.087899 7.557007 35.762664C264.318595 883.9701 273.442298 887.815163 286.64658 887.815163L286.64658 887.815163zM506.711119 886.65294c13.199162 0 22.153908-3.665865 26.807918-10.987355 4.64889-7.275411 6.968215-19.020515 6.968215-35.184112L540.487253 304.988705 468.275856 304.988705l0 535.492768C468.275856 871.241971 481.131983 886.65294 506.711119 886.65294L506.711119 886.65294zM725.679995 884.333615c13.956911 0 23.259811-3.609546 27.908701-10.941276 4.705209-7.32149 7.029655-19.066594 7.029655-35.230192L760.618351 304.988705l-73.373619 0 0 533.173442C687.249851 868.978965 700.039419 884.333615 725.679995 884.333615L725.679995 884.333615z'
    : 'M1004.657 801.716 602.263 91.599c-49.213-86.817-129.646-86.817-178.866 0L21.004 801.716c-49.207 86.906-8.949 157.798 89.388 157.798l804.877 0C1013.606 959.514 1053.825 888.622 1004.657 801.716zM544.635 832.216l-63.649 0 0-63.649 63.649 0L544.635 832.216zM544.635 641.27l-63.649 0L480.986 259.377l63.649 0L544.635 641.27z'
  return `
    <div class="api-token-dialog-body">
      <div class="api-token-icon" style="background:${iconBg};border-color:${iconBorder};" aria-hidden="true">
        <svg viewBox="${tone === 'danger' ? '0 0 1024 1024' : '0 0 1026 1024'}" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
          <path d="${iconPath}" fill="${iconFill}"></path>
        </svg>
      </div>
      <div class="api-token-content">
        <div class="api-token-title">${title}</div>
        <div class="api-token-desc">${desc}</div>
      </div>
    </div>
  `
}

async function openTokenConfirm(options: {
  title: string
  desc: string
  confirmText: string
  tone?: 'warning' | 'danger'
}) {
  await ElMessageBox.confirm(confirmDialogHtml(options.title, options.desc, options.tone || 'warning'), '', {
    type: 'warning',
    dangerouslyUseHTMLString: true,
    customClass: 'api-token-message-box',
    showClose: true,
    closeOnClickModal: false,
    showTitle: false,
    confirmButtonText: options.confirmText,
    cancelButtonText: '取消',
    confirmButtonClass: options.tone === 'danger' ? 'api-token-confirm-btn api-token-confirm-danger' : 'api-token-confirm-btn api-token-confirm-warning',
    cancelButtonClass: 'api-token-cancel-btn',
    center: false,
  })
}

async function generateToken() {
  if (status.configured) {
    try {
      await openTokenConfirm({
        title: '重新生成 Token',
        desc: '重新生成后，旧 Token 将会失效，确定继续？',
        confirmText: '生成',
        tone: 'warning',
      })
    } catch {
      return
    }
  }
  generating.value = true
  try {
    const res = await $fetch<{
      ok: boolean
      token: string
      hint: string
      createdAt: number
      message?: string
    }>('/api/open/token', { method: 'POST' })
    freshToken.value = res.token
    status.configured = true
    status.hint = res.hint
    status.createdAt = res.createdAt
    ElMessage.success(res.message || '已生成')
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '生成失败')
  } finally {
    generating.value = false
  }
}

async function revokeToken() {
  try {
    await openTokenConfirm({
      title: '删除 Token',
      desc: '删除后外部调用将立即失效。',
      confirmText: '删除',
      tone: 'danger',
    })
  } catch {
    return
  }
  revoking.value = true
  try {
    await $fetch('/api/open/token', { method: 'DELETE' })
    status.configured = false
    status.hint = ''
    status.createdAt = null
    freshToken.value = ''
    ElMessage.success('已删除')
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '删除失败')
  } finally {
    revoking.value = false
  }
}

onMounted(refresh)
</script>

<style scoped>
.api-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.docs-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.docs-panel {
  min-width: 0;
}

.docs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.docs-head .panel-title {
  margin: 0;
}

.docs-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #8b92a8;
  background: #f3f5fb;
  border: 1px solid #e8ebf5;
  border-radius: 999px;
  padding: 2px 8px;
  line-height: 1.5;
}

/* REST / MCP 列表：默认一排 2 个 */
.endpoint-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.endpoint-item {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 6px 10px;
  padding: 11px 14px;
  border: 1px solid #eef1f7;
  border-radius: 12px;
  background: #fbfcfe;
  min-width: 0;
}

.endpoint-item.tool-item {
  grid-template-columns: minmax(0, 1fr);
}

.method-tag {
  flex-shrink: 0;
  min-width: 68px;
  justify-content: center;
}

.path-code {
  display: block;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  color: #1b1f3b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.endpoint-desc {
  grid-column: 2;
  font-size: 12px;
  color: #8b92a8;
  line-height: 1.45;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.endpoint-item.tool-item .endpoint-desc {
  grid-column: 1;
}

.panel-desc {
  margin: 0 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.token-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-soft);
  padding: 12px 14px;
  margin-bottom: 14px;
}

.token-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 28px;
}

.token-row + .token-row {
  margin-top: 6px;
}

.token-label {
  width: 64px;
  color: var(--muted);
  font-size: 12px;
  flex-shrink: 0;
}

.token-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  color: var(--text);
}

.token-meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.fresh-token {
  border: 1px solid rgba(49, 204, 121, 0.35);
  background: #eefbf3;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
}

.fresh-title {
  font-size: 12px;
  color: #1f8f55;
  margin-bottom: 8px;
  font-weight: 600;
}

.fresh-body {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fresh-body code {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #163a28;
}

.token-actions {
  display: flex;
  gap: 10px;
}

.field-block {
  margin-bottom: 14px;
}

.field-label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

.code-line {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: #fafbff;
}

.code-line code {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}

.code-panel {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: #0f172a;
}

.code-panel .code-block {
  border-radius: 0;
  background: transparent;
}

.code-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.92);
}

.code-block {
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.55;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.copy-btn {
  min-width: 64px;
  height: 28px;
  padding: 0 12px;
  border-radius: 6px !important;
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

/* light surface (code-line / fresh token) */
:deep(.copy-btn.el-button.is-plain) {
  --el-button-bg-color: #fff;
  --el-button-border-color: #d7dce8;
  --el-button-text-color: #4b556b;
  --el-button-hover-bg-color: #f3f6fb;
  --el-button-hover-border-color: #c5ccd9;
  --el-button-hover-text-color: #1f2937;
  --el-button-active-bg-color: #eef2f8;
  --el-button-active-border-color: #b8c0d0;
}

/* dark surface (code panel actions) */
.code-actions :deep(.copy-btn.el-button.is-plain) {
  --el-button-bg-color: rgba(255, 255, 255, 0.06);
  --el-button-border-color: rgba(226, 232, 240, 0.28);
  --el-button-text-color: #e2e8f0;
  --el-button-hover-bg-color: rgba(255, 255, 255, 0.12);
  --el-button-hover-border-color: rgba(226, 232, 240, 0.4);
  --el-button-hover-text-color: #fff;
  --el-button-active-bg-color: rgba(255, 255, 255, 0.16);
  --el-button-active-border-color: rgba(226, 232, 240, 0.5);
}

@media (max-width: 1100px) {
  .api-grid {
    grid-template-columns: 1fr;
  }
}

/* 中等宽度：两列；更窄：单列 */
@media (max-width: 1100px) {
  .endpoint-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .endpoint-list {
    grid-template-columns: 1fr;
  }

  .endpoint-item {
    gap: 8px 12px;
  }
}

@media (max-width: 900px) {
  .endpoint-list {
    grid-template-columns: 1fr;
  }
  .api-grid {
    grid-template-columns: 1fr;
  }
}
</style>


<style>
/* API Token 确认弹窗（对齐任务/知识库删除弹窗） */
.api-token-message-box.el-message-box {
  width: min(440px, calc(100vw - 32px));
  max-width: 440px;
  border-radius: 16px;
  padding-bottom: 16px;
  box-shadow: 0 20px 48px rgba(28, 39, 76, 0.14);
  border: 1px solid #eef1f7;
  overflow: hidden;
}
.api-token-message-box .el-message-box__header { padding: 8px 12px 0; min-height: 0; }
.api-token-message-box .el-message-box__title { display: none !important; }
.api-token-message-box .el-message-box__headerbtn { top: 10px; right: 10px; }
.api-token-message-box .el-message-box__status { display: none !important; }
.api-token-message-box .el-message-box__content { padding: 12px 18px 4px; }
.api-token-message-box .el-message-box__container { align-items: flex-start; }
.api-token-message-box .el-message-box__message { width: 100%; padding-left: 0 !important; }
.api-token-dialog-body { display:flex; gap:14px; align-items:flex-start; }
.api-token-icon {
  width:48px;
  height:48px;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  border:1px solid transparent;
  flex-shrink:0;
}
.api-token-content { min-width:0; flex:1; }
.api-token-title { font-size:17px; font-weight:700; color:#1b1f3b; line-height:1.4; margin-bottom:10px; }
.api-token-desc { font-size:13px; color:#667085; line-height:1.55; margin-bottom:0; }
.api-token-message-box .el-message-box__btns { padding:14px 18px 2px; gap:10px; }
.api-token-message-box .el-message-box__btns .el-button { min-width:84px; border-radius:8px !important; font-weight:600; }
.api-token-message-box .api-token-cancel-btn { border-color:#d0d5dd; color:#475467; background:#fff; }
.api-token-message-box .api-token-cancel-btn:hover { border-color:#98a2b3; color:#1f2937; background:#f9fafb; }
.api-token-message-box .api-token-confirm-btn.api-token-confirm-warning,
.api-token-message-box .api-token-confirm-btn.api-token-confirm-warning:focus,
.api-token-message-box .api-token-confirm-btn.api-token-confirm-warning.is-plain {
  background: #E6A23C !important;
  border-color: #E6A23C !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(230, 162, 60, 0.35) !important;
}
.api-token-message-box .api-token-confirm-btn.api-token-confirm-warning:hover,
.api-token-message-box .api-token-confirm-btn.api-token-confirm-warning:active {
  background: #d8942f !important;
  border-color: #d8942f !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(230, 162, 60, 0.45) !important;
}
.api-token-message-box .api-token-confirm-btn.api-token-confirm-danger,
.api-token-message-box .api-token-confirm-btn.api-token-confirm-danger:focus,
.api-token-message-box .api-token-confirm-btn.api-token-confirm-danger.is-plain {
  background: #F56C6C !important;
  border-color: #F56C6C !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.35) !important;
}
.api-token-message-box .api-token-confirm-btn.api-token-confirm-danger:hover,
.api-token-message-box .api-token-confirm-btn.api-token-confirm-danger:active {
  background: #f45656 !important;
  border-color: #f45656 !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.45) !important;
}

@media (max-width: 480px) {
  .api-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .endpoint-list {
    grid-template-columns: 1fr;
  }
  .code-block {
    font-size: 12px;
  }
}
</style>
