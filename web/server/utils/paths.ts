import { mkdir } from 'node:fs/promises'
import { resolve, normalize, sep } from 'node:path'

export function getDataPaths() {
  const config = useRuntimeConfig()
  return {
    dataDir: config.dataDir as string,
    downloadsDir: config.downloadsDir as string,
    jobsFile: config.jobsFile as string,
    settingsFile: config.settingsFile as string,
  }
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
