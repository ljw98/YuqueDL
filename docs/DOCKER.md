# Docker 部署模板

## 文件

| 文件 | 说明 |
|------|------|
| `Dockerfile` | 多阶段构建 core + Nuxt，生产 Node 运行 |
| `docker-compose.yml` | 单实例服务 + 数据卷 |
| `.dockerignore` | 排除 node_modules / data / 调试产物 |
| `.github/workflows/docker.yml` | Actions：构建并推送 GHCR 镜像 |
| `.github/workflows/ci.yml` | Actions：单元测试 |

## 预构建镜像（GHCR）

仓库公开；GitHub Actions（`.github/workflows/docker.yml`）在推送 `master` / 打 `v*` tag / 手动触发时构建并推送：

| Tag | 说明 |
|-----|------|
| `ghcr.io/ljw98/yuquedl:latest` | `master` 最新构建 |
| `ghcr.io/ljw98/yuquedl:vX.Y.Z` | 语义化版本（打 tag 时） |
| `ghcr.io/ljw98/yuquedl:sha-<短提交>` | 对应 git commit |

Package：https://github.com/users/ljw98/packages/container/package/yuquedl  
Actions：https://github.com/ljw98/YuqueDL/actions  

```bash
docker pull ghcr.io/ljw98/yuquedl:latest

docker run --rm -p 8787:8787 \
  -v yuquedl-data:/data \
  -e YUQUE_DL_DATA=/data \
  -e YUQUE_DL_ACCESS_PASSWORD=your-password \
  -e YUQUE_DL_SECRET=long-random-string \
  ghcr.io/ljw98/yuquedl:latest
```

compose 也可改用预构建镜像（NAS / 飞牛不必本地 build）：

```yaml
services:
  yuquedl:
    image: ghcr.io/ljw98/yuquedl:latest
    # 去掉 build: 段即可；其余 ports / environment / volumes 与仓库模板相同
    container_name: yuquedl
    restart: unless-stopped
    ports:
      - "8787:8787"
    environment:
      HOST: 0.0.0.0
      PORT: 8787
      NITRO_HOST: 0.0.0.0
      NITRO_PORT: 8787
      YUQUE_DL_DATA: /data
      YUQUE_DL_ACCESS_PASSWORD: ${YUQUE_DL_ACCESS_PASSWORD:-}
      YUQUE_DL_SECRET: ${YUQUE_DL_SECRET:-}
    volumes:
      - yuquedl-data:/data
```

> 镜像为 **public**。若拉取仍 401，检查是否误用了私有 registry 凭据，或到 Package 设置确认可见性。

## 快速启动（本地 build）

```bash
# 在仓库根目录

# 可选：创建 .env
# YUQUE_DL_ACCESS_PASSWORD=your-password
# YUQUE_DL_SECRET=long-random-string

docker compose up -d --build
```

浏览器打开：http://localhost:8787/

数据持久化在 volume `yuquedl-data` → 容器内 `/data`：

```
/data
  settings.json
  jobs.json
  schedules.json
  downloads/
  .secret          # 未设置 YUQUE_DL_SECRET 时自动生成
  instance.lock
```

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `YUQUE_DL_DATA` | `/data`（compose） | 数据根目录 |
| `YUQUE_DL_ACCESS_PASSWORD` | 空 | 控制台访问密码（可与设置页登录保护配合） |
| `YUQUE_DL_SECRET` | 空 | 加密/会话密钥；生产建议固定设置 |
| `YUQUE_DL_COOKIE_SECURE` | `0` | HTTPS 反代时设 `1` |
| `YUQUE_DL_TRUST_PROXY` | `0` | 仅可信反代后设 `1`（影响登录限流 IP） |
| `YUQUE_DL_STRICT_SINGLE_INSTANCE` | `0` | `1` 时拒绝与存活锁冲突的第二实例 |
| `YUQUE_DL_CORE` | 镜像内 dist | 自定义 core 入口（一般不用） |
| `YUQUE_DL_JOBS_MAX` | `200` | 已完成任务最大保留条数（排队/运行中不删） |
| `YUQUE_DL_JOBS_KEEP_DAYS` | `30` | 已完成任务保留天数 |
| `YUQUE_DL_SCHEDULE_MAX_PER_DAY` | `48` | 定时同步全局每日入队上限 |
| `YUQUE_DL_SCHEDULE_MAX_PER_HOUR` | `12` | 定时同步全局每小时入队上限 |
| `YUQUE_DL_SCHEDULE_COOLDOWN_MS` | `300000` | 定时同步全局冷却（毫秒，默认 5 分钟） |
| `PORT` / `NITRO_PORT` | `8787` | 监听端口 |

## 注意

1. **不要** `docker compose up --scale` 共享同一数据卷：任务队列是单实例。
2. 反代 HTTPS 时：`YUQUE_DL_COOKIE_SECURE=1`，并视情况 `YUQUE_DL_TRUST_PROXY=1`。
3. 首次进入设置页粘贴 `_yuque_session`（见 `docs/GET_TOKEN.md`）。
4. 导出大库依赖容器内 `zip` 命令（Dockerfile 已安装）；无 `zip` 时回退到 Node 流式 store ZIP。

## 仅构建镜像

```bash
docker build -t yuquedl:local .
docker run --rm -p 8787:8787 -v yuquedl-data:/data \
  -e YUQUE_DL_DATA=/data \
  yuquedl:local
```

## 开发（非 Docker）

```bash
pnpm install
pnpm --dir web install
pnpm run dev:web   # http://0.0.0.0:8787
```
