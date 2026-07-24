<template>
  <div class="page-fill" style="height:auto;min-height:100%;">
    <div class="page-header">
      <div>
        <h1>设置</h1>
        <p>配置 Token、下载默认项、任务并发与登录保护。</p>
      </div>
    </div>

    <div class="settings-masonry" v-loading="loading">
      <div class="settings-col">
  <div class="panel">
          <div class="panel-head">
            <h3 class="panel-title">Token 设置</h3>
            <el-button
              v-if="tokenDirty"
              type="primary"
              :loading="savingToken"
              @click="saveToken"
            >
              保存
            </el-button>
          </div>
          <p class="panel-desc">
            登录语雀后按 F12 打开开发者工具 → Application → Cookies → <code>https://www.yuque.com</code> → 复制 <code>_yuque_session</code> 的 Value。
          </p>
          <el-form label-position="top" class="settings-form">
            <el-form-item label="语雀 Token">
              <div class="token-field">
                <el-input
                  v-model="form.token"
                  type="password"
                  show-password
                  clearable
                  size="large"
                  class="token-input"
                  :placeholder="tokenPlaceholder"
                  :disabled="clearingToken"
                  @paste="onTokenPaste"
                  @clear="onTokenFieldClear"
                >
                  <template v-if="hasSavedToken && !form.token" #suffix>
                    <!-- 与 el-input clearable 同款图标/样式 -->
                    <i
                      class="el-icon el-input__icon el-input__clear token-saved-clear"
                      role="button"
                      tabindex="0"
                      title="清除 Token"
                      aria-label="清除 Token"
                      @click.stop.prevent="!clearingToken && clearToken()"
                      @keydown.enter.prevent="!clearingToken && clearToken()"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
                        <path
                          fill="currentColor"
                          d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 393.664L407.936 353.6a38.4 38.4 0 1 0-54.336 54.336L457.664 512 353.6 616.064a38.4 38.4 0 1 0 54.336 54.336L512 566.336 616.064 670.4a38.4 38.4 0 1 0 54.336-54.336L566.336 512 670.4 407.936a38.4 38.4 0 1 0-54.336-54.336L512 457.664z"
                        />
                      </svg>
                    </i>
                  </template>
                </el-input>
                <el-button
                  type="primary"
                  size="large"
                  class="token-check-btn"
                  :loading="checkingToken"
                  @click="checkToken"
                >检测</el-button>
              </div>
            </el-form-item>
            <el-form-item label="Cookie Key">
              <div class="field-md">
                <el-input v-model="form.key" size="large" placeholder="_yuque_session" />
              </div>
            </el-form-item>
          </el-form>
        </div>
  <div class="panel">
          <div class="panel-head">
            <h3 class="panel-title">任务与并发</h3>
            <el-button
              v-if="concurrencyDirty"
              type="primary"
              :loading="savingConcurrency"
              @click="saveConcurrency"
            >
              保存
            </el-button>
          </div>
          <p class="panel-desc">设置同时下载数，以及列表是否自动刷新。</p>
          <el-form label-position="top" class="settings-form">
            <el-form-item label="自动刷新（任务页）">
              <div class="switch-row">
                <el-switch
                  :model-value="uiPrefs.autoRefreshTasks"
                  style="--el-switch-on-color: #31CC79;"
                  @change="onAutoRefreshTasksChange"
                />
              </div>
            </el-form-item>
            <el-form-item label="自动刷新（知识库页）">
              <div class="switch-row">
                <el-switch
                  :model-value="uiPrefs.autoRefreshLibrary"
                  style="--el-switch-on-color: #31CC79;"
                  @change="onAutoRefreshLibraryChange"
                />
              </div>
            </el-form-item>
            <el-form-item label="最大并发任务数">
              <el-input-number
                v-model="form.maxConcurrency"
                :min="1"
                :max="3"
                :step="1"
                controls-position="right"
              />
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div class="settings-col">
  <div class="panel">
          <div class="panel-head">
            <h3 class="panel-title">下载默认配置</h3>
            <el-button
              v-if="downloadDirty"
              type="primary"
              :loading="savingDownload"
              @click="saveDownload"
            >
              保存
            </el-button>
          </div>
          <p class="panel-desc">新建任务时默认采用这些选项。</p>
          <el-form label-position="top" class="settings-form">
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
                  <el-checkbox v-model="form.toc" border>生成目录</el-checkbox>
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
              <div class="field-md">
                <el-input
                  v-model="form.ignoreAttachmentExts"
                  size="large"
                  placeholder="例如 mp4,pdf,zip（留空则下载全部附件）"
                />
              </div>
            </el-form-item>
          </el-form>
        </div>
  <div class="panel">
          <div class="panel-head">
            <h3 class="panel-title">控制台安全</h3>
            <el-button
              v-if="securityDirty"
              type="primary"
              :loading="savingSecurity"
              @click="saveSecurity"
            >
              保存
            </el-button>
          </div>
          <p class="panel-desc">开启后访问需密码；关闭保护会一并清除已保存密码。</p>
          <el-form label-position="top" class="settings-form">
            <el-form-item label="登录保护">
              <div class="switch-row">
                <el-switch
                  v-model="form.accessAuthEnabled"
                  style="--el-switch-on-color: #31CC79;"
                />
              </div>
            </el-form-item>
            <el-form-item label="控制台访问密码">
              <div class="field-md">
                <el-input
                  v-model="form.accessPassword"
                  type="password"
                  show-password
                  size="large"
                  :placeholder="hasAccessPassword ? '已设置（输入新值可修改）' : '设置访问密码'"
                />
              </div>
            </el-form-item>
            <el-form-item v-if="hasAccessPassword" label="原访问密码">
              <div class="field-md">
                <el-input
                  v-model="form.oldAccessPassword"
                  type="password"
                  show-password
                  size="large"
                  placeholder="修改密码时需填写"
                />
              </div>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const form = reactive({
  token: '',
  key: '',
  ignoreImg: false,
  ignoreAllAttachments: false,
  ignoreAttachmentExts: '',
  incremental: false,
  toc: false,
  hideFooter: false,
  convertMarkdownVideoLinks: false,
  maxConcurrency: 1,
  accessAuthEnabled: true,
  accessPassword: '',
  oldAccessPassword: '',
})

/** 已保存基线：用于判断各卡片是否有未保存修改 */
const baseline = reactive({
  key: '',
  ignoreImg: false,
  ignoreAllAttachments: false,
  ignoreAttachmentExts: '',
  incremental: false,
  toc: false,
  hideFooter: false,
  convertMarkdownVideoLinks: false,
  maxConcurrency: 1,
  accessAuthEnabled: true,
})

const loading = ref(false)
const savingToken = ref(false)
const savingDownload = ref(false)
const savingConcurrency = ref(false)
const savingSecurity = ref(false)
const hasSavedToken = ref(false)
const savedTokenHint = ref('')
const hasAccessPassword = ref(false)
const checkingToken = ref(false)
const clearingToken = ref(false)

const tokenPlaceholder = computed(() => {
  if (hasSavedToken.value && savedTokenHint.value) return savedTokenHint.value
  if (hasSavedToken.value) return '已保存，输入新值可覆盖'
  return '未设置'
})

const tokenDirty = computed(() => {
  return Boolean(form.token.trim()) || form.key !== baseline.key
})

const downloadDirty = computed(() => {
  return (
    form.ignoreImg !== baseline.ignoreImg ||
    form.ignoreAllAttachments !== baseline.ignoreAllAttachments ||
    form.ignoreAttachmentExts !== baseline.ignoreAttachmentExts ||
    form.incremental !== baseline.incremental ||
    form.toc !== baseline.toc ||
    form.hideFooter !== baseline.hideFooter ||
    form.convertMarkdownVideoLinks !== baseline.convertMarkdownVideoLinks
  )
})

const concurrencyDirty = computed(() => {
  return Number(form.maxConcurrency) !== Number(baseline.maxConcurrency)
})

const securityDirty = computed(() => {
  return (
    form.accessAuthEnabled !== baseline.accessAuthEnabled ||
    Boolean(form.accessPassword.trim()) ||
    Boolean(form.oldAccessPassword.trim())
  )
})

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

function syncBaselineFromForm() {
  baseline.key = form.key || ''
  baseline.ignoreImg = form.ignoreImg
  baseline.ignoreAllAttachments = form.ignoreAllAttachments
  baseline.ignoreAttachmentExts = form.ignoreAttachmentExts
  baseline.incremental = form.incremental
  baseline.toc = form.toc
  baseline.hideFooter = form.hideFooter
  baseline.convertMarkdownVideoLinks = form.convertMarkdownVideoLinks
  baseline.maxConcurrency = form.maxConcurrency
  baseline.accessAuthEnabled = form.accessAuthEnabled
}

function applySettings(s: any = {}) {
  form.ignoreImg = Boolean(s.ignoreImg)
  parseIgnoreAttachments(s.ignoreAttachments)
  form.incremental = Boolean(s.incremental)
  form.toc = Boolean(s.toc)
  form.hideFooter = Boolean(s.hideFooter)
  form.convertMarkdownVideoLinks = Boolean(s.convertMarkdownVideoLinks)
  form.maxConcurrency = Math.min(3, Math.max(1, Number(s.maxConcurrency || 1)))
  form.key = s.key || ''
  form.accessAuthEnabled = s.accessAuthEnabled !== false
  hasSavedToken.value = Boolean(s.hasToken)
  // API 返回 maskToken，如 abcd****wxyz，用作已保存占位
  savedTokenHint.value = s.hasToken && s.token && String(s.token).includes('****')
    ? String(s.token)
    : (s.hasToken ? '••••••••••••' : '')
  hasAccessPassword.value = Boolean(s.hasAccessPassword)
  form.token = ''
  form.accessPassword = ''
  form.oldAccessPassword = ''
  syncBaselineFromForm()
}

async function loadSettings() {
  loading.value = true
  try {
    const res = await $fetch<{ settings: any }>('/api/settings')
    applySettings(res.settings || {})
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载设置失败')
  } finally {
    loading.value = false
  }
}

async function putSettings(body: Record<string, any>, okMsg = '已保存') {
  const res = await $fetch('/api/settings', { method: 'PUT', body })
  applySettings((res as any).settings || {})
  ElMessage.success(okMsg)
  return res
}

async function saveToken() {
  if (!tokenDirty.value) return
  savingToken.value = true
  try {
    const body: any = {
      key: form.key,
    }
    if (form.token) body.token = form.token
    await putSettings(body)
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '保存失败')
  } finally {
    savingToken.value = false
  }
}

async function saveDownload() {
  if (!downloadDirty.value) return
  savingDownload.value = true
  try {
    await putSettings({
      ignoreImg: form.ignoreImg,
      ignoreAttachments: buildIgnoreAttachments(),
      incremental: form.incremental,
      toc: form.toc,
      hideFooter: form.hideFooter,
      convertMarkdownVideoLinks: form.convertMarkdownVideoLinks,
    })
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '保存失败')
  } finally {
    savingDownload.value = false
  }
}

async function saveConcurrency() {
  if (!concurrencyDirty.value) return
  savingConcurrency.value = true
  try {
    await putSettings({ maxConcurrency: form.maxConcurrency })
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '保存失败')
  } finally {
    savingConcurrency.value = false
  }
}

async function saveSecurity() {
  if (!securityDirty.value) return
  savingSecurity.value = true
  try {
    const body: any = {
      accessAuthEnabled: form.accessAuthEnabled,
    }
    if (!form.accessAuthEnabled) {
      body.clearAccessPassword = true
      form.accessPassword = ''
      form.oldAccessPassword = ''
    } else if (form.accessPassword) {
      body.accessPassword = form.accessPassword
      if (form.oldAccessPassword) body.oldAccessPassword = form.oldAccessPassword
    }
    await putSettings(
      body,
      form.accessAuthEnabled ? '已保存' : '已保存，访问密码已清除',
    )
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '保存失败')
  } finally {
    savingSecurity.value = false
  }
}

function onTokenPaste(e: ClipboardEvent) {
  const raw = e.clipboardData?.getData('text') || ''
  if (!raw) return
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
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

async function checkToken() {
  checkingToken.value = true
  try {
    const body: any = { key: form.key }
    if (form.token) body.token = form.token
    const res = await $fetch<any>('/api/settings/token/check', { method: 'POST', body })
    const msg = res?.message || (res?.ok ? 'Token 有效' : 'Token 无效')
    if (res?.ok) ElMessage.success(msg)
    else ElMessage.warning(msg)
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '检测失败')
  } finally {
    checkingToken.value = false
  }
}

/** 输入框 clearable：只清当前输入内容；已保存 Token 用输入框内清除图标处理 */
function onTokenFieldClear() {
  form.token = ''
}

async function clearToken() {
  if (!hasSavedToken.value && !form.token) return
  const html = `
    <div class="clear-token-dialog-body">
      <div class="clear-token-icon" aria-hidden="true">
        <svg viewBox="0 0 1024 1024" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
          <path d="M865.392459 157.253321c23.31613 0 42.500482 3.834822 57.675935 11.540307 15.119133 7.705484 27.161193 17.32582 36.049379 28.866127 8.954746 11.509587 15.175452 24.01756 18.66724 37.503437 3.486668 13.465398 5.227442 25.963131 5.227442 37.503437 0 5.411759-0.168957 9.620336-0.573431 12.702529-0.409594 3.051474-0.578551 5.785513-0.578551 8.053639l0 6.942616-76.865407 0 0 605.871232c0 15.416089-3.087314 30.238266-9.3029 44.481893-6.220707 14.187307-15.175452 26.746479-26.807918 37.503437-11.627346 10.751839-25.814653 19.414749-42.500482 25.922171-16.69095 6.579101-35.870182 9.830253-57.624736 9.830253L249.378659 1023.9744c-20.182737 0-39.193012-3.082194-57.102503-9.246581-17.842932-6.164388-33.131023-14.827298-45.98715-25.99385-12.789568-11.094874-22.911656-24.590991-30.228027-40.350115-7.388049-15.815443-11.105113-33.658375-11.105113-53.661915L104.955866 300.370534 32.790548 300.370534c-0.814068-0.778228-1.162223-2.6982-1.162223-5.780393-0.819188-3.839942-1.167342-15.759124-1.167342-35.762664 0-9.99921 2.324445-21.160643 6.978455-33.489418 4.64889-12.287816 11.627346-23.659165 20.930246-34.00653 9.3029-10.413924 21.33984-19.076834 36.105698-25.99385 14.765859-6.917016 32.214557-10.372964 52.387054-10.372964l103.663085 0L250.525522 84.576011c0-20.02914 6.983575-37.150163 20.935366-51.398909 14.00811-14.218027 31.047214-21.33984 51.276031-21.33984l364.497573 0c27.150953 0 45.98715 7.121813 56.457393 21.33984 10.460003 14.243626 15.748884 31.36465 15.748884 51.398909l0 71.515087c16.286476 0.788468 33.724934 1.167342 52.381934 1.167342L865.392459 157.258441 865.392459 157.253321zM322.747159 157.253321l364.497573 0L687.244731 84.576011 322.747159 84.576011 322.747159 157.253321zM286.64658 887.815163c24.826508 0 37.267921-15.815443 37.267921-47.33369L323.914501 304.988705 251.697985 304.988705l0 535.492768c0 16.163598 2.498523 28.087899 7.557007 35.762664C264.318595 883.9701 273.442298 887.815163 286.64658 887.815163L286.64658 887.815163zM506.711119 886.65294c13.199162 0 22.153908-3.665865 26.807918-10.987355 4.64889-7.275411 6.968215-19.020515 6.968215-35.184112L540.487253 304.988705 468.275856 304.988705l0 535.492768C468.275856 871.241971 481.131983 886.65294 506.711119 886.65294L506.711119 886.65294zM725.679995 884.333615c13.956911 0 23.259811-3.609546 27.908701-10.941276 4.705209-7.32149 7.029655-19.066594 7.029655-35.230192L760.618351 304.988705l-73.373619 0 0 533.173442C687.249851 868.978965 700.039419 884.333615 725.679995 884.333615L725.679995 884.333615z" fill="#F97066"></path>
        </svg>
      </div>
      <div class="clear-token-content">
        <div class="clear-token-title">清除 Token</div>
        <div class="clear-token-desc">清除后需重新填写，私有库下载将暂时不可用。</div>
      </div>
    </div>
  `
  try {
    await ElMessageBox.confirm(html, '', {
      type: 'warning',
      dangerouslyUseHTMLString: true,
      customClass: 'clear-token-message-box',
      showClose: true,
      closeOnClickModal: false,
      showTitle: false,
      confirmButtonText: '清除',
      cancelButtonText: '取消',
      confirmButtonClass: 'clear-token-confirm-btn',
      cancelButtonClass: 'clear-token-cancel-btn',
      center: false,
    })
  } catch {
    return
  }
  clearingToken.value = true
  try {
    await putSettings({ clearToken: true }, '已清除 Token')
    form.token = ''
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '清除失败')
  } finally {
    clearingToken.value = false
  }
}

/** 页面自动刷新：任务 / 知识库各自独立，仅本浏览器 localStorage */
const { prefs: uiPrefs, setAutoRefreshTasks, setAutoRefreshLibrary } = useUiPrefs()

function onAutoRefreshTasksChange(v: string | number | boolean) {
  const enabled = Boolean(v)
  setAutoRefreshTasks(enabled)
  ElMessage.success(enabled ? '已开启任务页自动刷新' : '已关闭任务页自动刷新')
}

function onAutoRefreshLibraryChange(v: string | number | boolean) {
  const enabled = Boolean(v)
  setAutoRefreshLibrary(enabled)
  ElMessage.success(enabled ? '已开启知识库页自动刷新' : '已关闭知识库页自动刷新')
}

onMounted(async () => {
  await loadSettings()
})
</script>

<style scoped>
.settings-masonry {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  width: 100%;
}

.settings-col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.settings-col > .panel {
  width: 100%;
  margin: 0;
  box-sizing: border-box;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
  min-height: 32px;
}

.panel-head .panel-title {
  margin: 0;
}

.panel-desc {
  margin: 8px 0 16px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
/* 与下载页 Token 设置说明一致的行内 code 样式 */
.panel-desc code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  background: #e8f9f0;
  color: #2db86e;
  padding: 0.22em 0.55em;
  border-radius: 6px;
}

.settings-form :deep(.el-form-item) {
  margin-bottom: 18px;
}

.settings-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.field-md {
  width: 360px;
  max-width: 100%;
  min-width: 0;
}

.settings-form,
.settings-form :deep(.el-form-item),
.settings-form :deep(.el-form-item__content),
.token-field {
  min-width: 0;
  max-width: 100%;
}

/* 避免选项 chips 把卡片撑出横向滚动 / 被裁切 */
.option-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

/* tooltip 触发器必须可收缩，否则会把 checkbox 顶出卡片 */
.option-chips :deep(.el-tooltip__trigger) {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  vertical-align: top;
}

.option-chips :deep(.el-checkbox.is-bordered) {
  margin: 0 !important;
  max-width: 100%;
  height: auto !important;
  white-space: nowrap;
  box-sizing: border-box;
}

.option-chips :deep(.el-checkbox__label) {
  white-space: nowrap;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
}

.token-field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.token-field .token-input {
  flex: 1 1 auto;
  min-width: 0;
}
.token-check-btn {
  flex: 0 0 auto;
  margin-left: 0 !important;
}
/* 已保存 Token 时的清除图标：对齐 Element Plus clearable */
.token-input :deep(.el-input__suffix) {
  display: flex;
  align-items: center;
}
.token-input :deep(.token-saved-clear) {
  cursor: pointer;
  color: var(--el-input-icon-color, var(--el-text-color-placeholder));
  transition: color var(--el-transition-duration);
  margin-left: 0;
}
.token-input :deep(.token-saved-clear:hover) {
  color: var(--el-input-clear-hover-color, var(--el-text-color-secondary));
}
.token-input :deep(.token-saved-clear svg) {
  width: 1em;
  height: 1em;
  display: block;
}
.hint-ok {
  color: #12b76a !important;
}
.hint-bad {
  color: #f04438 !important;
}
@media (max-width: 1100px) {
  .settings-masonry {
    flex-direction: column;
    gap: 12px;
  }

  .settings-col {
    width: 100%;
    gap: 12px;
  }
}

/* 手机 / 窄屏：字段全宽、按钮等分、选项换行不裁切 */
@media (max-width: 900px) {
  .settings-masonry {
    flex-direction: column;
    gap: 12px;
    padding-bottom: 8px;
  }

  .settings-col {
    gap: 12px;
  }

  .settings-col > .panel {
    min-width: 0;
    max-width: 100%;
    overflow: visible;
  }

  .field-md {
    width: 100%;
    max-width: 100%;
  }

  .token-field {
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .token-check-btn {
    flex: 0 0 auto;
    min-height: 40px;
    padding: 0 14px;
  }

  /* grid 比 flex + tooltip 外壳更稳，彻底避免裁切 */
  .option-chips {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .option-chips :deep(.el-tooltip__trigger) {
    display: block !important;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .option-chips :deep(.el-checkbox.is-bordered) {
    width: 100%;
    max-width: 100%;
    margin: 0 !important;
    padding: 8px 10px !important;
    box-sizing: border-box;
    justify-content: flex-start;
  }

  .option-chips :deep(.el-checkbox__label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .panel-head {
    flex-wrap: wrap;
    gap: 8px;
  }

  .panel-desc {
    font-size: 12px;
    line-height: 1.55;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .settings-form :deep(.el-input-number) {
    width: 100%;
    max-width: 180px;
  }
}

@media (max-width: 480px) {
  .settings-masonry {
    gap: 10px;
  }

  .settings-col {
    gap: 10px;
  }

  /* 超窄屏仍保持两列；文字过长截断 + 完整文案在 tooltip */
  .option-chips :deep(.el-tooltip__trigger) {
    flex: 1 1 calc(50% - 4px);
    max-width: calc(50% - 4px);
  }
}
</style>

<style>
/* 清除语雀 Token 确认弹窗（对齐任务/接口删除弹窗） */
.clear-token-message-box.el-message-box {
  width: min(440px, calc(100vw - 32px));
  max-width: 440px;
  border-radius: 16px;
  padding-bottom: 16px;
  box-shadow: 0 20px 48px rgba(28, 39, 76, 0.14);
  border: 1px solid #eef1f7;
  overflow: hidden;
}
.clear-token-message-box .el-message-box__header { padding: 8px 12px 0; min-height: 0; }
.clear-token-message-box .el-message-box__title { display: none !important; }
.clear-token-message-box .el-message-box__headerbtn { top: 10px; right: 10px; }
.clear-token-message-box .el-message-box__status { display: none !important; }
.clear-token-message-box .el-message-box__content { padding: 12px 18px 4px; }
.clear-token-message-box .el-message-box__container { align-items: flex-start; }
.clear-token-message-box .el-message-box__message { width: 100%; padding-left: 0 !important; }
.clear-token-dialog-body { display: flex; gap: 14px; align-items: flex-start; }
.clear-token-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff1f0;
  border: 1px solid rgba(249, 112, 102, 0.18);
  flex-shrink: 0;
}
.clear-token-content { min-width: 0; flex: 1; }
.clear-token-title {
  font-size: 17px;
  font-weight: 700;
  color: #1b1f3b;
  line-height: 1.4;
  margin-bottom: 10px;
}
.clear-token-desc {
  font-size: 13px;
  color: #667085;
  line-height: 1.55;
  margin-bottom: 0;
}
.clear-token-message-box .el-message-box__btns { padding: 14px 18px 2px; gap: 10px; }
.clear-token-message-box .el-message-box__btns .el-button {
  min-width: 84px;
  border-radius: 8px !important;
  font-weight: 600;
}
.clear-token-message-box .clear-token-cancel-btn {
  border-color: #d0d5dd;
  color: #475467;
  background: #fff;
}
.clear-token-message-box .clear-token-cancel-btn:hover {
  border-color: #98a2b3;
  color: #1f2937;
  background: #f9fafb;
}
.clear-token-message-box .clear-token-confirm-btn,
.clear-token-message-box .clear-token-confirm-btn:focus,
.clear-token-message-box .clear-token-confirm-btn.is-plain {
  background: #F56C6C !important;
  border-color: #F56C6C !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.35) !important;
}
.clear-token-message-box .clear-token-confirm-btn:hover,
.clear-token-message-box .clear-token-confirm-btn:active {
  background: #f45656 !important;
  border-color: #f45656 !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.45) !important;
}
</style>
