import { listBooks } from '../../utils/library'
import {
  cancelTask,
  createTask,
  getTask,
  listTasks,
  loadJobsIntoMemory,
  publicTask,
  readSettings,
  retryTask,
  type TaskType,
} from '../../utils/store'
import { assertRateLimit, clientKey } from '../../utils/rate-limit'
import { sanitizeExternalTaskOptions } from '../../utils/task-options'
import { materializeBookExport } from '../../utils/export-zip'

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: any
}

const SERVER_INFO = {
  name: 'yuque-dl',
  version: '1.0.0',
}

const TOOLS = [
  {
    name: 'yuque_status',
    description: '获取 Yuque DL 服务状态、任务数与知识库数量',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'yuque_list_tasks',
    description: '列出下载任务，可按状态过滤',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'queued | running | success | failed | cancelled',
        },
        limit: {
          type: 'number',
          description: '最多返回条数，默认 20，最大 100',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'yuque_get_task',
    description: '按任务 ID 查询详情（含进度与最近日志）',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '任务 ID' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'yuque_create_task',
    description:
      '创建下载任务。type: book(整库)/docs(文档)/batch(批量知识库)/user(账号全部)。会使用服务端已保存的语雀 Token。',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['book', 'docs', 'batch', 'user'],
          description: '任务类型，默认 book',
        },
        urls: {
          oneOf: [
            { type: 'string', description: '单个 URL 或换行分隔的多个 URL' },
            { type: 'array', items: { type: 'string' } },
          ],
          description: '语雀链接；type=user 时可省略',
        },
        options: {
          type: 'object',
          description: '可选下载选项（忽略图片/附件/TOC 等），不含 token',
          properties: {
            ignoreImg: { type: 'boolean' },
            ignoreAttachments: {
              oneOf: [
                { type: 'boolean' },
                { type: 'string', description: '忽略的附件后缀，逗号分隔，如 mp4,pdf' },
              ],
            },
            toc: { type: 'boolean' },
            incremental: { type: 'boolean' },
            convertMarkdownVideoLinks: { type: 'boolean' },
            hideFooter: { type: 'boolean' },
            password: { type: 'string', description: '知识库访问密码（若有）' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'yuque_cancel_task',
    description: '取消排队中或进行中的任务',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'yuque_retry_task',
    description: '重试失败或已取消的任务',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'yuque_list_books',
    description: '列出已下载的知识库',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'yuque_export_book',
    description:
      '将本地已下载知识库打包为 ZIP。返回 zip 文件名、大小与 Open API 下载路径（GET /api/open/library/:book/export，需 Bearer）。与控制台导出共享全局限流/互斥。',
    inputSchema: {
      type: 'object',
      properties: {
        book: {
          type: 'string',
          description: '知识库目录名（与 yuque_list_books 返回的 name 一致）',
        },
        name: {
          type: 'string',
          description: '同 book（别名）',
        },
      },
      additionalProperties: false,
    },
  },
]

function ok(id: JsonRpcId | undefined, result: unknown) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  }
}

function fail(id: JsonRpcId | undefined, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message, data },
  }
}

function textResult(data: unknown) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return {
    content: [{ type: 'text', text }],
  }
}

function parseUrls(urls: unknown): string[] {
  if (Array.isArray(urls)) {
    return urls.map((s) => String(s || '').trim()).filter(Boolean)
  }
  if (typeof urls === 'string') {
    return urls
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

async function callTool(
  name: string,
  args: Record<string, any> = {},
  event?: any,
) {
  await loadJobsIntoMemory()

  switch (name) {
    case 'yuque_status': {
      const settings = await readSettings()
      const tasks = listTasks().map(publicTask)
      const books = await listBooks()
      return textResult({
        service: 'yuque-dl',
        version: SERVER_INFO.version,
        maxConcurrency: Math.min(3, Math.max(1, Number(settings.maxConcurrency || 1))),
        stats: {
          tasks: tasks.length,
          running: tasks.filter((t) => t.status === 'running' || t.status === 'queued').length,
          books: books.length,
        },
      })
    }
    case 'yuque_list_tasks': {
      let tasks = listTasks().map(publicTask)
      const status = String(args.status || '').trim()
      if (status) tasks = tasks.filter((t) => t.status === status)
      const limit = Math.min(100, Math.max(1, Number(args.limit || 20) || 20))
      return textResult({ tasks: tasks.slice(0, limit) })
    }
    case 'yuque_get_task': {
      const id = String(args.id || '').trim()
      if (!id) throw createError({ statusCode: 400, statusMessage: '缺少 id' })
      const task = getTask(id)
      if (!task) throw createError({ statusCode: 404, statusMessage: '任务不存在' })
      return textResult({ task: publicTask(task) })
    }
    case 'yuque_create_task': {
      if (event) assertRateLimit(clientKey(event, 'mcp-create-task'), 10, 60_000)
      const type = String(args.type || 'book') as TaskType
      const allowed: TaskType[] = ['book', 'docs', 'batch', 'user']
      if (!allowed.includes(type)) {
        throw createError({ statusCode: 400, statusMessage: '无效的任务类型' })
      }
      // strip session secrets only; keep knowledge-base access password
      const options = sanitizeExternalTaskOptions(args.options)
      const task = await createTask({
        type,
        urls: parseUrls(args.urls),
        options,
      })
      return textResult({ task })
    }
    case 'yuque_cancel_task': {
      const id = String(args.id || '').trim()
      if (!id) throw createError({ statusCode: 400, statusMessage: '缺少 id' })
      const task = await cancelTask(id)
      return textResult({ task })
    }
    case 'yuque_retry_task': {
      const id = String(args.id || '').trim()
      if (!id) throw createError({ statusCode: 400, statusMessage: '缺少 id' })
      const task = await retryTask(id)
      return textResult({ task })
    }
    case 'yuque_list_books': {
      const books = await listBooks()
      return textResult({ books })
    }
    case 'yuque_export_book': {
      if (event) assertRateLimit(clientKey(event, 'mcp-export'), 3, 60_000)
      const book = String(args.book || args.name || '').trim()
      if (!book) throw createError({ statusCode: 400, statusMessage: '缺少 book（知识库目录名）' })
      const result = await materializeBookExport(book)
      // Do not expose absolute server path to clients
      return textResult({
        ok: true,
        book: result.book,
        zipName: result.zipName,
        size: result.size,
        sizeHuman:
          result.size >= 1024 * 1024
            ? `${(result.size / (1024 * 1024)).toFixed(2)} MB`
            : `${Math.max(1, Math.round(result.size / 1024))} KB`,
        downloadPath: result.downloadPath,
        downloadUrlHint: `GET ${result.downloadPath} with Authorization: Bearer <API_TOKEN>`,
        engine: result.engine,
        note: 'ZIP 已生成于服务端 data/exports/；请用 Open API 下载或在控制台知识库页导出。',
      })
    }
    default:
      throw createError({ statusCode: 400, statusMessage: `未知工具: ${name}` })
  }
}

async function handleOne(req: JsonRpcRequest, event?: any) {
  const id = req.id
  const method = String(req.method || '')

  try {
    if (req.jsonrpc && req.jsonrpc !== '2.0') {
      return fail(id, -32600, 'Invalid Request: jsonrpc must be 2.0')
    }

    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        })
      case 'notifications/initialized':
      case 'initialized':
        return ok(id, {})
      case 'ping':
        return ok(id, {})
      case 'tools/list':
        return ok(id, { tools: TOOLS })
      case 'tools/call': {
        const name = String(req.params?.name || '')
        const args = (req.params?.arguments || {}) as Record<string, any>
        if (!name) return fail(id, -32602, 'Missing tool name')
        const result = await callTool(name, args, event)
        return ok(id, result)
      }
      default:
        return fail(id, -32601, `Method not found: ${method || '(empty)'}`)
    }
  } catch (err: any) {
    const status = Number(err?.statusCode || err?.status || 0)
    const message = String(err?.statusMessage || err?.message || 'Internal error')
    if (status >= 400 && status < 500) {
      return ok(id, {
        content: [{ type: 'text', text: `Error: ${message}` }],
        isError: true,
      })
    }
    return fail(id, -32000, message)
  }
}

export default defineEventHandler(async (event) => {
  const body = (await readBody<JsonRpcRequest | JsonRpcRequest[]>(event)) || {}
  if (Array.isArray(body)) {
    const results = []
    for (const item of body) {
      results.push(await handleOne(item, event))
    }
    return results
  }
  return handleOne(body, event)
})
