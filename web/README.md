# Yuque DL Web Console

语雀知识库下载器的 Web 可视化操作台。

## 功能特性

- **下载任务管理**：创建、查看、取消、重试下载任务
- **实时进度推送**：SSE 推送下载进度和日志
- **知识库浏览**：目录树 + Markdown 预览 + 图片渲染
- **设置管理**：Token/Cookie Key 配置、默认下载选项
- **任务重试**：失败任务一键重试

## 技术栈

- **前端**：Nuxt 3 + Vue 3 + Element Plus
- **后端**：Nitro（Nuxt Server）+ SSE
- **Core**：TypeScript + Rollup（复用原 yuque-dl）

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 预览
pnpm preview
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks` | 创建任务 |
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/tasks/:id` | 任务详情 |
| POST | `/api/tasks/:id/cancel` | 取消任务 |
| POST | `/api/tasks/:id/retry` | 重试任务 |
| GET | `/api/tasks/:id/events` | SSE 实时推送 |
| GET | `/api/library` | 已下载知识库列表 |
| GET | `/api/library/:book/tree` | 知识库文件树 |
| GET | `/api/library/:book/file` | 读取文件内容 |
| GET | `/api/files/*` | 静态资源（图片/附件） |
| GET | `/api/settings` | 获取设置 |
| PUT | `/api/settings` | 更新设置 |
