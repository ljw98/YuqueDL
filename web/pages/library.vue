<template>
  <div class="page-fill">
    <div class="page-header">
      <div>
        <h1>知识库</h1>
        <p>浏览已下载内容，支持 Markdown 预览与本地图片。</p>
      </div>
    </div>

    <div class="panel library-panel">
      <div class="library-layout">
        <div class="tree-panel">
          <div class="book-select-row">
            <el-select
              v-model="currentBook"
              placeholder="选择知识库"
              style="flex:1;min-width:0;"
              :filterable="false"
              @change="onBookChange"
            >
              <el-option
                v-for="b in books"
                :key="b.path"
                :label="bookOptionLabel(b)"
                :value="b.path"
              />
            </el-select>
            <el-dropdown
              trigger="click"
              :disabled="!currentBook || exporting || exportingPage || deleting"
              @command="onBookAction"
            >
              <el-button
                class="book-more-btn"
                :disabled="!currentBook || exporting || exportingPage || deleting"
                :loading="exporting || exportingPage || deleting"
                title="更多操作"
                aria-label="更多操作"
              >
                <svg
                  v-if="!(exporting || exportingPage || deleting)"
                  class="book-more-icon"
                  viewBox="0 0 1024 1024"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M204.8 409.6a102.4 102.4 0 1 1 0 204.8 102.4 102.4 0 0 1 0-204.8z m307.2 0a102.4 102.4 0 1 1 0 204.8 102.4 102.4 0 0 1 0-204.8z m307.2 0a102.4 102.4 0 1 1 0 204.8 102.4 102.4 0 0 1 0-204.8z" fill="currentColor" />
                </svg>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="export-page" :disabled="!canExportPage || exportingPage">
                    导出当前页面
                  </el-dropdown-item>
                  <el-dropdown-item command="export" :disabled="!currentBook || exporting">
                    导出整个知识库
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" :disabled="!currentBook || deleting">
                    <span class="book-action-danger">删除知识库</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <el-scrollbar class="tree-scroll" v-loading="loadingTree">
            <el-tree
              v-if="treeData.length"
              :data="treeData"
              node-key="path"
              :props="{ label: 'label', children: 'children', isLeaf: 'isLeaf' }"
              highlight-current
              lazy
              :load="loadTreeNode"
              :default-expanded-keys="expandedKeys"
              @node-click="onNodeClick"
            />
            <div v-else class="reader-empty" style="min-height:180px;">
              <div class="library-empty-title">{{ currentBook ? '暂无文件' : '请选择知识库' }}</div>
            </div>
          </el-scrollbar>
        </div>

        <div class="library-divider" aria-hidden="true"></div>

        <div class="reader-panel" v-loading="loadingFile">
          <template v-if="fileMeta">
            <div class="task-head">
              <div>
                <h3 class="panel-title" style="margin:0;">{{ fileMeta.name }}</h3>
                <div class="muted" style="margin-top:6px;font-size:12px;">{{ fileMeta.path }}</div>
              </div>
            </div>

            <el-scrollbar class="reader-body">
              <div
                v-if="fileMeta.type === 'text' && isMarkdown"
                class="md-preview"
                v-html="html"
                @click.capture="onPreviewClick"
              />
              <pre
                v-else-if="fileMeta.type === 'text'"
                class="log-box"
                style="max-height:none;height:100%;white-space:pre-wrap;"
              >{{ fileMeta.content }}</pre>
              <div v-else-if="isImage" style="padding:8px 0;">
                <img :src="fileMeta.url" :alt="fileMeta.name" style="max-width:100%;border-radius:14px;" />
              </div>
              <div v-else class="reader-empty" style="min-height:200px;">
                <el-link :href="fileMeta.url" target="_blank" type="primary">打开 / 下载文件</el-link>
              </div>
            </el-scrollbar>
          </template>
          <div v-else class="reader-empty library-empty">
            <svg class="library-empty-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="88" height="88">
              <path d="M832.7 63.9H189.6c-69.6 0-126.3 56.7-126.3 126.3v643.1c0 69.6 56.7 126.3 126.3 126.3h643.1c69.6 0 126.3-56.7 126.3-126.3V190.2c0-69.7-56.6-126.3-126.3-126.3zM276.3 339.1l39.6-39.6 51.7 51.7 51.7-51.7 39.6 39.6-51.7 51.7 51.7 51.7-39.6 39.5-51.7-51.7-51.7 51.7-39.6-39.6 51.7-51.7-51.7-51.6z m37 430.9c0-111.5 90.4-201.8 201.8-201.8S716.9 658.5 716.9 770H313.3zM746 442.4L706.5 482l-51.7-51.7-51.7 51.7-39.6-39.6 51.7-51.7-51.7-51.7 39.6-39.6 51.7 51.7 51.7-51.7L746 339l-51.7 51.7 51.7 51.7z" fill="#B3B3B3" />
            </svg>
            <div class="library-empty-title">选择左侧文件开始阅读</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LibraryBook, TreeNode } from '~/types/api'

const { renderMarkdown } = useMarkdown()
const route = useRoute()

const books = ref<LibraryBook[]>([])
const currentBook = ref('')
const treeData = ref<TreeNode[]>([])
const fileMeta = ref<any>(null)
const html = ref('')
const loadingBooks = ref(false)
const loadingTree = ref(false)
const loadingFile = ref(false)
const deleting = ref(false)
const exporting = ref(false)
const exportingPage = ref(false)
const expandedKeys = ref<string[]>([])

const isMarkdown = computed(() => ['.md', '.markdown'].includes(String(fileMeta.value?.ext || '').toLowerCase()))
const isImage = computed(() => ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(String(fileMeta.value?.ext || '').toLowerCase()))
const canExportPage = computed(() => {
  const m = fileMeta.value
  if (!currentBook.value || !m?.path) return false
  if (m.type === 'text' && typeof m.content === 'string') return true
  if (m.url) return true
  return false
})
function formatSize(bytes?: number) {
  const n = Number(bytes || 0)
  if (!n || n < 0) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function bookOptionLabel(b: LibraryBook) {
  const size = formatSize(b.size)
  return b.size ? `${b.name}（${size}）` : b.name
}

async function loadBooks() {
  loadingBooks.value = true
  try {
    const res = await $fetch<{ books: any[] }>('/api/library')
    books.value = res.books || []
    if (!currentBook.value && books.value.length) {
      currentBook.value = books.value[0].path
      await onBookChange()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loadingBooks.value = false
  }
}

function decorateTreeNodes(nodes: TreeNode[]): any[] {
  return (nodes || []).map((n) => {
    if (n.type === 'dir') {
      // lazy 目录节点不要给 children，交给 el-tree load 拉取
      const { children: _children, ...rest } = n as any
      return { ...rest, isLeaf: false }
    }
    return { ...n, isLeaf: true, children: undefined }
  })
}

async function fetchTreeLevel(path = '') {
  const res = await $fetch<{ tree: TreeNode[] }>(`/api/library/${encodeURIComponent(currentBook.value)}/tree`, {
    query: path ? { path } : undefined,
  })
  return decorateTreeNodes(res.tree || [])
}

async function onBookChange() {
  fileMeta.value = null
  html.value = ''
  if (!currentBook.value) {
    treeData.value = []
    return
  }
  loadingTree.value = true
  try {
    treeData.value = await fetchTreeLevel('')
    // 默认只展开第一层目录 key（懒加载时实际展开会触发 load）
    expandedKeys.value = treeData.value.filter((n: any) => n.type === 'dir').map((n: any) => n.path)
    // index.md 若在根层则自动打开
    const indexNode = treeData.value.find((n: any) => n.type === 'file' && n.label === 'index.md')
    if (indexNode) await openFile(indexNode.path)
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '读取目录失败')
  } finally {
    loadingTree.value = false
  }
}

async function loadTreeNode(node: any, resolve: (data: any[]) => void) {
  // root level already loaded via treeData
  if (node.level === 0) {
    resolve(treeData.value)
    return
  }
  const data = node.data || {}
  if (data.type !== 'dir') {
    resolve([])
    return
  }
  try {
    const children = await fetchTreeLevel(data.path)
    resolve(children)
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载子目录失败')
    resolve([])
  }
}

async function onNodeClick(node: any) {
  if (node.type !== 'file') return
  await openFile(node.path)
}

function onPreviewClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return
  const a = target.closest('a') as HTMLAnchorElement | null
  if (!a || !a.closest('.md-preview')) return
  const href = a.getAttribute('href') || ''
  const isInternalMd =
    a.getAttribute('data-yuque-link') === '1' ||
    (href.startsWith('#') && /\.md($|[?#])/i.test(href))
  if (!isInternalMd) return
  e.preventDefault()
  e.stopPropagation()
  const path = href.replace(/^#/, '').split(/[?#]/)[0].trim()
  if (path) void openFile(path)
}

async function openFile(path: string) {
  if (!currentBook.value) return
  loadingFile.value = true
  try {
    const res = await $fetch(`/api/library/${encodeURIComponent(currentBook.value)}/file`, {
      query: { path },
    })
    fileMeta.value = res
    if (res.type === 'text' && ['.md', '.markdown'].includes(String(res.ext || '').toLowerCase())) {
      html.value = renderMarkdown(res.content || '', currentBook.value, path)
    } else {
      html.value = ''
    }
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '读取文件失败')
  } finally {
    loadingFile.value = false
  }
}

function onBookAction(command: string | number) {
  if (command === 'export-page') {
    void exportCurrentPage()
    return
  }
  if (command === 'export') {
    void exportCurrentBook()
    return
  }
  if (command === 'delete') {
    void removeCurrentBook()
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement('a')
  const href = URL.createObjectURL(blob)
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

async function exportCurrentPage() {
  if (!canExportPage.value || exportingPage.value) return
  const meta = fileMeta.value
  if (!meta) return
  exportingPage.value = true
  try {
    const filename = String(meta.name || 'page.md').replace(/[\\/:*?"<>|]/g, '_')
    if (meta.type === 'text' && typeof meta.content === 'string') {
      const blob = new Blob([meta.content], { type: 'text/markdown;charset=utf-8' })
      triggerDownload(blob, filename)
      ElMessage.success('已开始下载页面')
      return
    }
    if (meta.url) {
      const res = await fetch(meta.url, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('下载当前页面失败')
      const blob = await res.blob()
      triggerDownload(blob, filename)
      ElMessage.success('已开始下载页面')
      return
    }
    throw new Error('当前页面不可导出')
  } catch (e: any) {
    ElMessage.error(e?.message || '导出当前页面失败')
  } finally {
    exportingPage.value = false
  }
}

async function exportCurrentBook() {
  if (!currentBook.value || exporting.value) return
  exporting.value = true
  try {
    const url = `/api/library/${encodeURIComponent(currentBook.value)}/export`
    // Single request: server streams ZIP; client still materializes blob for filename + error text.
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) {
      let msg = '导出失败'
      try {
        const data = await res.json()
        msg = data?.statusMessage || data?.message || msg
      } catch {
        // ignore
      }
      throw new Error(msg)
    }
    const ct = res.headers.get('content-type') || ''
    if (/html|json/i.test(ct)) {
      const text = await res.text()
      throw new Error(text.slice(0, 120) || '导出失败：响应不是 ZIP')
    }
    const blob = await res.blob()
    const dispo = res.headers.get('content-disposition') || ''
    let filename = `${currentBook.value}.zip`
    const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(dispo)
    if (m) filename = decodeURIComponent((m[1] || m[2] || '').trim())
    const a = document.createElement('a')
    const href = URL.createObjectURL(blob)
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
    ElMessage.success('已开始下载压缩包')
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

async function removeCurrentBook() {
  if (!currentBook.value || deleting.value) return

  const bookName = currentBook.value
  const dialogHtml = `
    <div class="delete-book-dialog-body">
      <div class="delete-book-icon" aria-hidden="true">
        <svg viewBox="0 0 1024 1024" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
          <path d="M865.392459 157.253321c23.31613 0 42.500482 3.834822 57.675935 11.540307 15.119133 7.705484 27.161193 17.32582 36.049379 28.866127 8.954746 11.509587 15.175452 24.01756 18.66724 37.503437 3.486668 13.465398 5.227442 25.963131 5.227442 37.503437 0 5.411759-0.168957 9.620336-0.573431 12.702529-0.409594 3.051474-0.578551 5.785513-0.578551 8.053639l0 6.942616-76.865407 0 0 605.871232c0 15.416089-3.087314 30.238266-9.3029 44.481893-6.220707 14.187307-15.175452 26.746479-26.807918 37.503437-11.627346 10.751839-25.814653 19.414749-42.500482 25.922171-16.69095 6.579101-35.870182 9.830253-57.624736 9.830253L249.378659 1023.9744c-20.182737 0-39.193012-3.082194-57.102503-9.246581-17.842932-6.164388-33.131023-14.827298-45.98715-25.99385-12.789568-11.094874-22.911656-24.590991-30.228027-40.350115-7.388049-15.815443-11.105113-33.658375-11.105113-53.661915L104.955866 300.370534 32.790548 300.370534c-0.814068-0.778228-1.162223-2.6982-1.162223-5.780393-0.819188-3.839942-1.167342-15.759124-1.167342-35.762664 0-9.99921 2.324445-21.160643 6.978455-33.489418 4.64889-12.287816 11.627346-23.659165 20.930246-34.00653 9.3029-10.413924 21.33984-19.076834 36.105698-25.99385 14.765859-6.917016 32.214557-10.372964 52.387054-10.372964l103.663085 0L250.525522 84.576011c0-20.02914 6.983575-37.150163 20.935366-51.398909 14.00811-14.218027 31.047214-21.33984 51.276031-21.33984l364.497573 0c27.150953 0 45.98715 7.121813 56.457393 21.33984 10.460003 14.243626 15.748884 31.36465 15.748884 51.398909l0 71.515087c16.286476 0.788468 33.724934 1.167342 52.381934 1.167342L865.392459 157.258441 865.392459 157.253321zM322.747159 157.253321l364.497573 0L687.244731 84.576011 322.747159 84.576011 322.747159 157.253321zM286.64658 887.815163c24.826508 0 37.267921-15.815443 37.267921-47.33369L323.914501 304.988705 251.697985 304.988705l0 535.492768c0 16.163598 2.498523 28.087899 7.557007 35.762664C264.318595 883.9701 273.442298 887.815163 286.64658 887.815163L286.64658 887.815163zM506.711119 886.65294c13.199162 0 22.153908-3.665865 26.807918-10.987355 4.64889-7.275411 6.968215-19.020515 6.968215-35.184112L540.487253 304.988705 468.275856 304.988705l0 535.492768C468.275856 871.241971 481.131983 886.65294 506.711119 886.65294L506.711119 886.65294zM725.679995 884.333615c13.956911 0 23.259811-3.609546 27.908701-10.941276 4.705209-7.32149 7.029655-19.066594 7.029655-35.230192L760.618351 304.988705l-73.373619 0 0 533.173442C687.249851 868.978965 700.039419 884.333615 725.679995 884.333615L725.679995 884.333615z" fill="#F97066"></path>
        </svg>
      </div>
      <div class="delete-book-content">
        <div class="delete-book-title">删除知识库</div>
        <div class="delete-book-desc">将删除「${bookName}」的本地文件，且不可恢复。</div>
      </div>
    </div>
  `

  try {
    await ElMessageBox.confirm(dialogHtml, '', {
      type: 'warning',
      dangerouslyUseHTMLString: true,
      customClass: 'delete-book-message-box',
      showClose: true,
      closeOnClickModal: false,
      showTitle: false,
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'delete-book-confirm-btn',
      cancelButtonClass: 'delete-book-cancel-btn',
      center: false,
    })
  } catch {
    return
  }

  deleting.value = true
  const deletedName = currentBook.value
  try {
    await $fetch(`/api/library/${encodeURIComponent(deletedName)}/delete`, { method: 'POST' })
    ElMessage.success('已删除')
    books.value = books.value.filter((b) => b.path !== deletedName)
    currentBook.value = books.value[0]?.path || ''
    treeData.value = []
    fileMeta.value = null
    html.value = ''
    expandedKeys.value = []
    if (currentBook.value) {
      await onBookChange()
    }
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

const { prefs: uiPrefs } = useUiPrefs()
const autoRefresh = computed(() => uiPrefs.autoRefreshLibrary !== false)

let refreshTimer: ReturnType<typeof setInterval> | null = null

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  if (!autoRefresh.value) return
  // 仅静默刷新知识库列表（体积等），不打断当前阅读
  refreshTimer = setInterval(() => {
    void loadBooksQuiet()
  }, 5000)
}

async function loadBooksQuiet() {
  try {
    const res = await $fetch<{ books: any[] }>('/api/library')
    books.value = res.books || []
    // 当前选中库被删时清空
    if (currentBook.value && !books.value.some((b) => b.path === currentBook.value)) {
      currentBook.value = books.value[0]?.path || ''
      if (currentBook.value) await onBookChange()
      else {
        treeData.value = []
        fileMeta.value = null
        html.value = ''
      }
    }
  } catch {
    // 静默失败，不弹 toast 打扰阅读
  }
}

onMounted(async () => {
  await loadBooks()
  startAutoRefresh()
  // topbar 搜索带过来的 q 仅作提示
  if (route.query.q) {
    // no-op for now
  }
})

watch(autoRefresh, () => {
  startAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.book-select-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex: 0 0 auto;
}

.book-more-btn {
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* loading 时只留转圈，去掉默认右间距和空 span，避免图标偏左 */
.book-more-btn.is-loading :deep(> span) {
  display: none !important;
}

.book-more-btn :deep(.el-icon.is-loading) {
  margin: 0 !important;
}

.book-more-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.book-action-danger {
  color: #f56c6c;
}

/* 与任务中心空状态一致：图标与文字仅 2px 间距 */
.library-empty.reader-empty,
.library-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0 !important;
  min-height: 280px;
  padding: 72px 16px 40px;
  color: var(--muted);
  text-align: center;
}

.library-empty-icon {
  display: block;
  margin: 0 0 2px;
}

.library-empty-title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  /* 对齐任务中心表格空状态 .el-table__empty-text 的行高 */
  line-height: 60px;
  color: #b0b6c6;
}
</style>

<style>
/* 删除知识库确认弹窗 */
.delete-book-message-box.el-message-box {
  width: min(440px, calc(100vw - 32px));
  max-width: 440px;
  border-radius: 16px;
  padding-bottom: 16px;
  box-shadow: 0 20px 48px rgba(28, 39, 76, 0.14);
  border: 1px solid #eef1f7;
  overflow: hidden;
}
.delete-book-message-box .el-message-box__header { padding: 8px 12px 0; min-height: 0; }
.delete-book-message-box .el-message-box__title { display: none !important; }
.delete-book-message-box .el-message-box__headerbtn { top: 10px; right: 10px; }
.delete-book-message-box .el-message-box__status { display: none !important; }
.delete-book-message-box .el-message-box__content { padding: 12px 18px 4px; }
.delete-book-message-box .el-message-box__container { align-items: flex-start; }
.delete-book-message-box .el-message-box__message { width: 100%; padding-left: 0 !important; }
.delete-book-dialog-body { display:flex; gap:14px; align-items:flex-start; }
.delete-book-icon {
  width:48px;
  height:48px;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#fff1f0;
  border:1px solid rgba(249,112,102,0.18);
  flex-shrink:0;
}
.delete-book-content { min-width:0; flex:1; }
.delete-book-title { font-size:17px; font-weight:700; color:#1b1f3b; line-height:1.4; margin-bottom:10px; }
.delete-book-desc { font-size:13px; color:#667085; line-height:1.55; margin-bottom:0; }
.delete-book-message-box .el-message-box__btns { padding:14px 18px 2px; gap:10px; }
.delete-book-message-box .el-message-box__btns .el-button { min-width:84px; border-radius:8px !important; font-weight:600; }
.delete-book-message-box .delete-book-cancel-btn { border-color:#d0d5dd; color:#475467; background:#fff; }
.delete-book-message-box .delete-book-cancel-btn:hover { border-color:#98a2b3; color:#1f2937; background:#f9fafb; }
.delete-book-message-box .delete-book-confirm-btn,
.delete-book-message-box .delete-book-confirm-btn:focus,
.delete-book-message-box .delete-book-confirm-btn.is-plain {
  background: #F56C6C !important;
  border-color: #F56C6C !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.35) !important;
}
.delete-book-message-box .delete-book-confirm-btn:hover,
.delete-book-message-box .delete-book-confirm-btn:active {
  background: #f45656 !important;
  border-color: #f45656 !important;
  color: #fff !important;
  box-shadow: 0 8px 18px rgba(245, 108, 108, 0.45) !important;
}

/* mobile library */
@media (max-width: 900px) {
  .library-empty {
    min-height: 200px;
    padding: 40px 12px 28px;
  }
  .book-select-row {
    gap: 8px;
  }
}
</style>
