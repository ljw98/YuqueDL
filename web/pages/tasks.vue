<template>
  <div class="page-fill" style="height:auto;min-height:100%;">
    <div class="page-header">
      <div>
        <h1>任务中心</h1>
        <p>查看历史与进行中的下载任务，支持取消与日志回看。</p>
      </div>
      <el-button round :loading="loading" @click="refresh">刷新</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="label">全部任务</div>
        <div class="value">{{ tasks.length }}</div>
      </div>
      <div class="stat-card">
        <div class="label">进行中</div>
        <div class="value">{{ countBy('running') + countBy('queued') }}</div>
      </div>
      <div class="stat-card">
        <div class="label">成功</div>
        <div class="value">{{ countBy('success') }}</div>
      </div>
      <div class="stat-card">
        <div class="label">失败</div>
        <div class="value">{{ countBy('failed') }}</div>
      </div>
    </div>

    <div class="panel" style="padding:0;overflow:hidden;">
      <el-table :data="tasks" stripe v-loading="loading" empty-text="暂无任务" style="--el-table-border:none;">
        <el-table-column prop="type" label="类型" width="110">
          <template #default="{ row }">
            <el-tag :type="row.type === 'book' ? 'primary' : 'info'" size="small" effect="light">{{ typeText(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="目标" min-width="240">
          <template #default="{ row }">
            <div v-if="row.type === 'user'">账号全部知识库</div>
            <div v-else class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              <a
                v-for="(url, idx) in row.urls || []"
                :key="idx"
                :href="url"
                target="_blank"
                style="color: var(--text-secondary); text-decoration: none;"
                @click.stop
              >
                {{ shortUrl(url) }}
                <span v-if="idx < (row.urls || []).length - 1" style="margin: 0 4px;">|</span>
              </a>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="light">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="140">
          <template #default="{ row }">
            {{ row.current || 0 }}/{{ row.total || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'running' || row.status === 'queued'"
              size="small"
              @click="cancel(row.id)"
            >
              取消
            </el-button>
            <el-button
              v-if="row.status === 'failed' || row.status === 'cancelled'"
              size="small"
              type="warning"
              @click="retry(row.id)"
            >
              重试
            </el-button>
            <el-button size="small" @click="showDetail(row)">详情</el-button>
            <el-button size="small" type="danger" @click="remove(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer v-model="drawer" title="任务详情" size="440px">
      <template v-if="current">
        <div class="panel panel-soft" style="margin-bottom:14px;">
          <p style="margin:0 0 8px;"><b>状态：</b>{{ statusText(current.status) }}</p>
          <p style="margin:0 0 8px;"><b>进度：</b>{{ current.current }}/{{ current.total }}</p>
          <p v-if="current.message" style="margin:0 0 8px;"><b>消息：</b>{{ current.message }}</p>
          <p v-if="current.error" style="margin:0 0 8px;color:var(--danger);"><b>错误：</b>{{ current.error }}</p>
          <p v-if="current.bookName" style="margin:0;"><b>知识库：</b>{{ current.bookName }}</p>
        </div>
        <div class="log-box" style="max-height:50vh;">
          <div v-for="(line, i) in current.logs || []" :key="i" :class="`log-line-${line.level}`">
            [{{ formatTime(line.ts) }}] {{ line.message }}
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
const tasks = ref<any[]>([])
const loading = ref(false)
const drawer = ref(false)
const current = ref<any>(null)

function typeText(t: string) {
  return ({ book: '整库', docs: '文档', batch: '批量', user: '账号全部' } as any)[t] || t
}
function statusText(s: string) {
  return ({ queued: '排队中', running: '下载中', success: '成功', failed: '失败', cancelled: '已取消' } as any)[s] || s
}
function statusType(s: string) {
  return ({ queued: 'info', running: '', success: 'success', failed: 'danger', cancelled: 'warning' } as any)[s] || 'info'
}
function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}
function shortUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, '')
}
function countBy(status: string) {
  return tasks.value.filter((t) => t.status === status).length
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

function showDetail(row: any) {
  current.value = row
  drawer.value = true
}

async function remove(id: string) {
  try {
    await $fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    ElMessage.success('已删除')
    await refresh()
  } catch (e: any) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '删除失败')
  }
}

onMounted(refresh)
let timer: any
onMounted(() => {
  timer = setInterval(refresh, 5000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>
