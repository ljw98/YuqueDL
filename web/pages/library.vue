<template>
  <div class="page-fill">
    <div class="page-header">
      <div>
        <h1>知识库</h1>
        <p>浏览已下载内容，支持 Markdown 预览与本地图片。</p>
      </div>
      <el-button round :loading="loadingBooks" @click="loadBooks">刷新</el-button>
    </div>

    <div class="library-layout">
      <div class="panel tree-panel">
        <h3 class="panel-title">已下载</h3>
        <el-select
          v-model="currentBook"
          placeholder="选择知识库"
          style="width:100%;margin-bottom:14px;flex:0 0 auto;"
          filterable
          @change="onBookChange"
        >
          <el-option v-for="b in books" :key="b.path" :label="b.name" :value="b.path" />
        </el-select>

        <div class="tree-scroll" v-loading="loadingTree">
          <el-tree
            v-if="treeData.length"
            :data="treeData"
            node-key="path"
            :props="{ label: 'label', children: 'children' }"
            highlight-current
            :default-expanded-keys="expandedKeys"
            @node-click="onNodeClick"
          />
          <div v-else class="reader-empty" style="min-height:180px;">
            <div>{{ currentBook ? '暂无文件' : '请选择知识库' }}</div>
          </div>
        </div>
      </div>

      <div class="panel reader-panel" v-loading="loadingFile">
        <template v-if="fileMeta">
          <div class="task-head">
            <div>
              <h3 class="panel-title" style="margin:0;">{{ fileMeta.name }}</h3>
              <div class="muted" style="margin-top:6px;font-size:12px;">{{ fileMeta.path }}</div>
            </div>
            <el-tag v-if="isMarkdown" effect="light" type="primary" round>Markdown</el-tag>
          </div>

          <div class="reader-body">
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
          </div>
        </template>
        <div v-else class="reader-empty">
          <div style="font-size:16px;font-weight:700;color:var(--text);">选择左侧文件开始阅读</div>
          <div>支持 Markdown、图片与常见附件</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { renderMarkdown } = useMarkdown()
const route = useRoute()

const books = ref<any[]>([])
const currentBook = ref('')
const treeData = ref<any[]>([])
const fileMeta = ref<any>(null)
const html = ref('')
const loadingBooks = ref(false)
const loadingTree = ref(false)
const loadingFile = ref(false)
const expandedKeys = ref<string[]>([])

const isMarkdown = computed(() => ['.md', '.markdown'].includes(String(fileMeta.value?.ext || '').toLowerCase()))
const isImage = computed(() => ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(String(fileMeta.value?.ext || '').toLowerCase()))

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

async function onBookChange() {
  fileMeta.value = null
  html.value = ''
  if (!currentBook.value) {
    treeData.value = []
    return
  }
  loadingTree.value = true
  try {
    const res = await $fetch<{ tree: any[] }>(`/api/library/${encodeURIComponent(currentBook.value)}/tree`)
    treeData.value = res.tree || []
    // 默认只展开第一层目录
    expandedKeys.value = collectFirstLevelDirs(treeData.value)
    const indexNode = findFile(treeData.value, 'index.md')
    if (indexNode) await openFile(indexNode.path)
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '读取目录失败')
  } finally {
    loadingTree.value = false
  }
}

function collectFirstLevelDirs(nodes: any[]): string[] {
  const keys: string[] = []
  for (const n of nodes) {
    if (n.type === 'dir') {
      keys.push(n.path)
    }
  }
  return keys
}

function findFile(nodes: any[], name: string): any | null {
  for (const n of nodes) {
    if (n.type === 'file' && n.label === name) return n
    if (n.children) {
      const hit = findFile(n.children, name)
      if (hit) return hit
    }
  }
  return null
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

onMounted(async () => {
  await loadBooks()
  // topbar 搜索带过来的 q 仅作提示
  if (route.query.q) {
    // no-op for now
  }
})
</script>
