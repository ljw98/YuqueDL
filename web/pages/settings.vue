<template>
  <div class="page-fill" style="height:auto;min-height:100%;">
    <div class="page-header">
      <div>
        <h1>设置</h1>
        <p>默认下载参数与鉴权信息。Token 仅保存在服务端本地文件，接口返回会脱敏。</p>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="label">Token</div>
        <div class="value" style="font-size:22px;">{{ form.hasToken ? '已保存' : '未设置' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">Cookie Key</div>
        <div class="value" style="font-size:18px;">{{ form.key || '_yuque_session' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">默认增量</div>
        <div class="value" style="font-size:22px;">{{ form.incremental ? '开启' : '关闭' }}</div>
      </div>
      <div class="stat-card">
        <div class="label">忽略图片</div>
        <div class="value" style="font-size:22px;">{{ form.ignoreImg ? '是' : '否' }}</div>
      </div>
    </div>

    <div class="panel" v-loading="loading">
      <h3 class="panel-title">默认配置</h3>
      <el-form label-position="top" style="max-width:760px;">
        <el-form-item label="语雀 Token（cookie 值）">
          <el-input
            v-model="form.token"
            type="password"
            show-password
            :placeholder="form.hasToken ? '已保存（输入新值可覆盖）' : '未设置'"
          />
          <div class="muted" style="margin-top:8px;font-size:12px;">
            从浏览器 DevTools → Application → Cookies 复制 `_yuque_session` 的值。
          </div>
        </el-form-item>

        <el-form-item label="Cookie Key（企业版可改）">
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

        <div style="display:flex;gap:10px;">
          <el-button type="primary" round :loading="saving" @click="save">保存</el-button>
          <el-button v-if="form.hasToken" round @click="clearToken">清除 Token</el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
const loading = ref(false)
const saving = ref(false)
const form = reactive({
  token: '',
  key: '',
  hasToken: false,
  ignoreImg: false,
  ignoreAttachments: false,
  incremental: false,
  toc: false,
  hideFooter: false,
  convertMarkdownVideoLinks: false,
})

async function load() {
  loading.value = true
  try {
    const res = await $fetch<{ settings: any }>('/api/settings')
    const s = res.settings || {}
    form.token = ''
    form.key = s.key || ''
    form.hasToken = Boolean(s.hasToken)
    form.ignoreImg = Boolean(s.ignoreImg)
    form.ignoreAttachments = Boolean(s.ignoreAttachments)
    form.incremental = Boolean(s.incremental)
    form.toc = Boolean(s.toc)
    form.hideFooter = Boolean(s.hideFooter)
    form.convertMarkdownVideoLinks = Boolean(s.convertMarkdownVideoLinks)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function save() {
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
    form.hasToken = Boolean((res as any).settings?.hasToken)
    form.token = ''
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function clearToken() {
  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: { clearToken: true },
    })
    form.hasToken = false
    form.token = ''
    ElMessage.success('Token 已清除')
  } catch (e: any) {
    ElMessage.error(e?.message || '清除失败')
  }
}

onMounted(load)
</script>
