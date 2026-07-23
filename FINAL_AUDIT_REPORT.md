# Yuque DL Web 最终审计与修复报告

- 日期：2026-07-20
- 服务：http://localhost:8787/
- 功能验证：修复后 19/19 关键检查通过；单测通过

## 结论

**无 P0/P1 阻断缺陷。** 本地/内网可稳定使用。  
审计发现的 P2/P3 问题已尽量落地修复。

---

## 本轮已修复

### P2
1. **docs 模式扁平重名覆盖**
   - 改为按 `downloads/{bookSlug}/` 分层保存
   - 同目录重名追加 `docId`
2. **任务队列单实例风险**
   - 启动写 `data/instance.lock`
   - 检测到其他 pid 时输出警告
   - README 明确单实例约束

### P3 / 安全加固
3. **非法多段 API 路径落到 SPA HTML**
   - 新增 `/api/[...slug]` 统一 JSON 404
4. **删除知识库任务关联启发式**
   - 任务新增 `targetBooks`
   - 删除冲突优先匹配 `targetBooks`
5. **batch 进度语义混杂**
   - 库序号进入 message 前缀与 phase
   - 文档进度 current/total 不再被库序号覆盖
6. **Cookie CSRF 风险**
   - 新增 CSRF 中间件：对带 Origin/Referer 的写请求做同域校验
7. **文档不足**
   - 根 README 增加 Web 控制台章节
   - web/README 补充并发/删除/部署注意
8. **单测扩展**
   - book name / url 解析 / concurrency clamp

### 审计中已完成的安全项（回顾）
- 登录限流（1 分钟 10 次）
- 环境密钥 HMAC 派生
- 取消访问密码明文兼容
- SVG 强制附件下载
- `assertBookName` 防穿越
- Cookie Secure 可配置 `YUQUE_DL_COOKIE_SECURE=1`

---

## 仍保留的非阻断项

| 级别 | 项 | 说明 |
|------|----|------|
| P3 | 前后端类型仍有双份定义 | `store.ts` 与 `types/api.ts` 已同步字段，但未完全合并导入 |
| P3 | 前端 `any` 仍偏多 | 不影响功能，可逐步替换 |
| P3 | 缺 Playwright/E2E | 当前有单测 + API 脚本校验 |
| P3 | 大知识库 progress.json 较大 | 性能优化项，非缺陷 |
| 架构 | 队列仍是单实例内存调度 | 已加锁文件警告与文档说明；多实例需拆 data 目录 |

---

## 关键行为变化

1. **docs 下载路径**：`data/downloads/{book}/xxx.md`
2. **任务对象新增** `targetBooks`
3. **未知 API**：返回 JSON 404，不再回 HTML
4. **跨站 Origin 写请求**：403
5. **batch 进度文案**：`[库 i/n] ...`

---

## 验证清单

- [x] core / web 构建通过
- [x] 单测通过
- [x] API 基础接口正常
- [x] 路径穿越拒绝
- [x] API catch-all JSON 404
- [x] CSRF Origin 校验
- [x] targetBooks 写入
- [x] settings 并发可写
- [x] 文档更新

## 上线建议

- 本机/内网：可直接使用
- 公网：务必 HTTPS + `YUQUE_DL_COOKIE_SECURE=1` + 访问密码
- 不要多进程共享同一 `data/` 跑任务
