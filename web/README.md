# YuqueDL Web Console

语雀知识库 Web 可视化操作台（Nuxt 3）。

## 功能特性

- **下载任务管理**：创建、查看、取消、删除、重试
- **实时进度**：任务详情 SSE 日志
- **定时同步**：按小时/天/周自动增量入队（任务中心页）；全局预算防刷
- **知识库浏览**：目录树 + Markdown 预览 + 图片
- **导出 ZIP**：整库流式导出（中文路径 UTF-8）
- **设置**：Token 检测/清除、默认下载选项、并发、页面自动刷新、登录保护
- **Open API / MCP**：Bearer Token 接入
- **移动端**：底栏导航 + 响应式表格

## 技术栈

- 前端：Nuxt 3 + Vue 3 + Element Plus
- 后端：Nitro + 进程内任务队列
- Core：仓库根目录 `yuque-dl`（Rollup 构建）

## 开发

```bash
# 在仓库根
pnpm install
pnpm --dir web install
pnpm run dev:web          # 构建 core 并启动 8787

# 或仅 web 目录（需已 build:core）
pnpm dev
pnpm build
pnpm preview
```

## 单测

```bash
pnpm test:unit
# 或
node tests/security-basics.mjs
node tests/classify-error.mjs
node tests/task-options.mjs
```

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks` | 创建任务（限流 10/min） |
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/tasks/:id` | 任务详情 |
| DELETE | `/api/tasks/:id` | 删除任务记录 |
| POST | `/api/tasks/:id/cancel` | 取消 |
| POST | `/api/tasks/:id/retry` | 重试 |
| GET | `/api/tasks/:id/events` | SSE |
| GET | `/api/schedules` | 定时规则列表 |
| POST | `/api/schedules` | 添加定时 |
| PUT | `/api/schedules/:id` | 更新/启停 |
| DELETE | `/api/schedules/:id` | 删除定时 |
| POST | `/api/schedules/:id/run` | 立即运行（计入全局预算） |
| GET | `/api/library` | 已下载知识库 |
| GET | `/api/library/:book/tree` | 目录树 |
| GET | `/api/library/:book/file` | 读文件 |
| GET | `/api/library/:book/export` | 导出 ZIP（全局互斥） |
| POST | `/api/library/:book/delete` | 删除知识库 |
| GET/PUT | `/api/settings` | 设置 |
| POST | `/api/settings/token/check` | Token 检测（限流 6/min） |
| GET | `/api/open/library` | 已下载知识库列表（Bearer） |
| GET | `/api/open/library/:book/export` | 导出知识库 ZIP（Bearer，限流+互斥） |
| GET/POST | `/api/open/*` | Open API（Bearer） |
| GET/POST | `/api/mcp` | MCP JSON-RPC（Bearer；含 `yuque_export_book`） |

## 设置项

- 语雀 Token / Cookie Key / 默认下载选项（忽略图片、附件后缀、增量等）
- `maxConcurrency`：1~3
- 任务页 / 知识库页自动刷新开关
- 登录保护开关 + 访问密码
- API Token（Open / MCP）

## 部署注意

- 默认端口 **8787**
- 任务队列**单实例**；多进程请拆分 `data` 目录
- HTTPS：`YUQUE_DL_COOKIE_SECURE=1`
- 数据目录：`YUQUE_DL_DATA`（Docker 见 `docs/DOCKER.md`）
- 严格单实例：`YUQUE_DL_STRICT_SINGLE_INSTANCE=1`
- 反代后限流 IP：`YUQUE_DL_TRUST_PROXY=1`

## 环境变量

| 变量 | 说明 |
|------|------|
| `YUQUE_DL_ACCESS_PASSWORD` | 控制台访问密码 |
| `YUQUE_DL_SECRET` | 加密/会话密钥 |
| `YUQUE_DL_DATA` | 数据根目录 |
| `YUQUE_DL_COOKIE_SECURE` | HTTPS Secure Cookie |
| `YUQUE_DL_TRUST_PROXY` | 信任 X-Forwarded-For（登录 + 通用限流） |
| `YUQUE_DL_STRICT_SINGLE_INSTANCE` | 锁冲突时拒绝加载队列 |
| `YUQUE_DL_CORE` | core 入口路径 |
| `YUQUE_DL_JOBS_MAX` | 已完成任务最大条数（默认 200） |
| `YUQUE_DL_JOBS_KEEP_DAYS` | 已完成任务保留天数（默认 30） |
| `YUQUE_DL_SCHEDULE_MAX_PER_DAY` | 定时同步每日上限（默认 48） |
| `YUQUE_DL_SCHEDULE_MAX_PER_HOUR` | 定时同步每小时上限（默认 12） |
| `YUQUE_DL_SCHEDULE_COOLDOWN_MS` | 定时同步全局冷却毫秒（默认 300000） |

## 安全与审计

产品设定：局域网开放可用为预期。实现细节与冒烟结果见：

- [docs/PROJECT.md](../docs/PROJECT.md)
- [docs/AUDIT_2026-07-22.md](../docs/AUDIT_2026-07-22.md)
- [docs/AUDIT_2026-07-23.md](../docs/AUDIT_2026-07-23.md)
.md](../docs/AUDIT_2026-07-23.md)
