import { access, mkdir } from 'node:fs/promises'
import { dirname, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export function getDataPaths() {
  const config = useRuntimeConfig()
  // Prefer runtime env so Docker volume mount works without rebuild
  const envData = String(process.env.YUQUE_DL_DATA || '').trim()
  if (envData) {
    const dataDir = resolve(envData)
    return {
      dataDir,
      downloadsDir: resolve(dataDir, 'downloads'),
      jobsFile: resolve(dataDir, 'jobs.json'),
      settingsFile: resolve(dataDir, 'settings.json'),
      schedulesFile: resolve(dataDir, 'schedules.json'),
    }
  }
  return {
    dataDir: config.dataDir as string,
    downloadsDir: config.downloadsDir as string,
    jobsFile: config.jobsFile as string,
    settingsFile: config.settingsFile as string,
    schedulesFile: (config.schedulesFile as string) || `${config.dataDir}/schedules.json`,
  }
}

/** Resolve yuque-dl core entry robustly across dev/prod layouts. */
export async function resolveCoreEntry() {
  const config = useRuntimeConfig()
  const candidates: string[] = []
  if (config.coreEntry) candidates.push(String(config.coreEntry))
  if (process.env.YUQUE_DL_CORE) candidates.push(process.env.YUQUE_DL_CORE)

  // web/ -> project root
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const projectRoot = resolve(webRoot, '..')
  candidates.push(
    resolve(projectRoot, 'dist/es/index.js'),
    resolve(projectRoot, 'server-lib/bundle.js'),
  )

  // nitro output chunks path fallback: .output/server/chunks/_ or utils -> up to project
  const fromMeta = resolve(fileURLToPath(import.meta.url), '../../../../dist/es/index.js')
  candidates.push(fromMeta)

  for (const p of candidates) {
    try {
      await access(p)
      return p
    } catch {
      // try next
    }
  }
  throw createError({
    statusCode: 500,
    statusMessage: '无法定位 yuque-dl 核心模块，请先构建 dist 或设置 YUQUE_DL_CORE',
  })
}

export async function ensureDataDirs() {
  const { dataDir, downloadsDir } = getDataPaths()
  await mkdir(dataDir, { recursive: true })
  await mkdir(downloadsDir, { recursive: true })
}

/** 确保目标路径落在 root 内，防止路径穿越 */
export function resolveSafe(root: string, relativePath = '') {
  const rootResolved = resolve(root)
  const target = resolve(rootResolved, relativePath || '.')
  const rootWithSep = rootResolved.endsWith(sep) ? rootResolved : rootResolved + sep
  if (target !== rootResolved && !target.startsWith(rootWithSep)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }
  return normalize(target)
}
