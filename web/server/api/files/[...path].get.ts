import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { ensureDataDirs, getDataPaths, resolveSafe } from '../../utils/paths'
import { sendStream } from 'h3'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
}

export default defineEventHandler(async (event) => {
  await ensureDataDirs()
  const raw = getRouterParam(event, 'path') || ''
  const rel = decodeURIComponent(raw)
  if (!rel || rel.includes('\0')) throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  const { downloadsDir } = getDataPaths()
  const full = resolveSafe(downloadsDir, rel)
  const s = await stat(full)
  if (!s.isFile()) {
    throw createError({ statusCode: 404, statusMessage: 'file not found' })
  }
  const ext = extname(full).toLowerCase()
  setHeader(event, 'Content-Type', MIME[ext] || 'application/octet-stream')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  // SVG 可能含脚本；强制下载，降低直出执行风险
  if (ext === '.svg') {
    setHeader(event, 'Content-Disposition', `attachment; filename="${basename(full).replace(/"/g, '')}"`)
    setHeader(event, 'Content-Type', 'application/octet-stream')
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
  }
  return sendStream(event, createReadStream(full))
})
