# YuqueDL 项目介绍

## 一句话

把语雀知识库下载为本地 Markdown，并提供 Web 控制台做任务管理、知识库预览、定时同步与 Open API / MCP 接入。

## 组成

| 部分 | 路径 | 说明 |
|------|------|------|
| 下载引擎 | `src/` + `dist/` / `server-lib/` | 基于 yuque-dl 核心二次开发的下载能力（Web 动态加载） |
| Web 控制台 | `web/` | Nuxt 3 + Element Plus + Nitro API |
| 运行时数据 | `data/` | `settings.json` / `jobs.json` / `schedules.json` / `downloads/` |

## 控制台能力

- **下载页**：创建整库 / 文档 / 批量 / 账号全部；公开/私有访问类型
- **任务中心**：下载任务列表 + 定时同步规则；取消 / 重试 / 详情 SSE 日志；任务来源 `manual` / `schedule` / `retry`
- **知识库**：目录树、Markdown 预览、导出 ZIP、删除
- **设置**：Token 检测/清除、默认下载选项、并发、双页自动刷新、登录保护
- **接口**：Bearer Token 的 Open REST 与 JSON-RPC MCP Tools（含 `yuque_export_book` 导出 ZIP）

## 技术栈

- Node.js ≥ 18.4
- TypeScript + Rollup（core）
- Nuxt 3 + Vue 3 + Element Plus（web）
- 本地 JSON 落盘 + 进程内任务队列（单实例）

## 安全边界（产品设定）

- **局域网可匿名使用是预期**；登录保护可关
- 语雀 Token：AES-GCM 加密落盘；API 列表仅 mask
- 访问密码 / API Token：scrypt + timingSafeEqual
- 路径：`assertBookName` + `resolveSafe` 防穿越
- CSRF：浏览器写请求同源校验
- Open/MCP：Bearer；`sanitizeExternalTaskOptions` 剥离 session `token`/`key`（保留知识库 `password`）
- 导出：流式 ZIP + 全局限 1 并发 + 轻量限流
- 安全头：`nosniff` / `SAMEORIGIN` / `Referrer-Policy`；API `no-store`
- 非 development：去掉 API 错误 stack（见 `error-sanitize` 插件）

## 稳定性策略

| 项 | 默认 | 环境变量 |
|----|------|----------|
| 已完成任务保留 | 最多 200 条 / 30 天 | `YUQUE_DL_JOBS_MAX` / `YUQUE_DL_JOBS_KEEP_DAYS` |
| 定时全局预算 | 48/天、12/小时、冷却 5 分钟 | `YUQUE_DL_SCHEDULE_*` |
| 建任务限流 | 10/min | — |
| 导出限流 | 3/min + 全局 1 并发 | — |
| Token 检测 | 6/min | — |

## 单实例约束

任务队列在**进程内存**调度，状态落盘 `data/jobs.json`。

- 默认：检测到其他 `instance.lock` 仅告警
- `YUQUE_DL_STRICT_SINGLE_INSTANCE=1`：其他进程仍存活则拒绝加载队列

## 界面截图

见仓库根 [README](../README.md)「界面预览」，文件位于 `docs/assets/screenshots/`：

| 文件 | 页面 |
|------|------|
| `01-download.png` | 下载 |
| `02-tasks.png` | 任务中心 |
| `03-library.png` | 知识库 |
| `04-api.png` | 接口 |
| `05-settings.png` | 设置 |

## 发布与 CI

| 项 | 说明 |
|----|------|
| 仓库 | https://github.com/ljw98/YuqueDL （public） |
| 单元 CI | `.github/workflows/ci.yml` → `pnpm --dir web test:unit` |
| 镜像 CI | `.github/workflows/docker.yml` → `ghcr.io/ljw98/yuquedl` |
| 预构建镜像 | `latest` / `sha-*` / 语义化 `v*` tag |
| 许可 | ISC（`LICENSE`）；上游致谢见 `NOTICE` |

## 相关文档

- [根 README](../README.md) — 快速开始与截图
- [Web README](../web/README.md) — 控制台功能与 API 表
- [Docker](./DOCKER.md) — 本地 compose / GHCR 预构建镜像
- [获取 Token](./GET_TOKEN.md) — 语雀 `_yuque_session`
- [审计 2026-07-22](./AUDIT_2026-07-22.md)
- [审计 2026-07-23](./AUDIT_2026-07-23.md)
