import { readdir, readFile, rm, stat } from 'node:fs/promises'
import { join, relative, extname, basename } from 'node:path'
import { ensureDataDirs, getDataPaths, resolveSafe } from './paths'

/** 知识库名只允许单层目录名，禁止穿越 */
export function assertBookName(bookName: string) {
  const name = decodeURIComponent(String(bookName || '')).trim()
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.includes('..')
  ) {
    throw createError({ statusCode: 400, statusMessage: '无效的知识库名称' })
  }
  return name
}

export interface LibraryBook {
  name: string
  path: string
  mtime: number
  hasIndex: boolean
  /** total bytes under the book directory */
  size?: number
  /** bytes under media-like dirs (img/assets/attachments/...) */
  mediaSize?: number
}

export interface TreeNode {
  label: string
  path: string
  type: 'dir' | 'file'
  children?: TreeNode[]
  lazy?: boolean
}

const DOC_EXTS = new Set(['.md', '.markdown', '.txt', '.json', '.csv'])
const MEDIA_DIR_NAMES = new Set(['img', 'images', 'image', 'assets', 'attachments', 'videos', 'media'])

function isMediaLikeDir(name: string) {
  const lower = name.toLowerCase()
  if (MEDIA_DIR_NAMES.has(lower)) return true
  // yuque image hash folders, e.g. C6ycYpzJj5kRBZw1 / PlIu820kANE-00U7
  return /^[A-Za-z0-9_-]{10,}$/.test(name)
}

/** Walk book dir: total size + media size (named media dirs + hash-like image folders). */
async function measureBookSizes(root: string): Promise<{ size: number; mediaSize: number }> {
  let size = 0
  let mediaSize = 0

  async function walk(dir: string, underMedia: boolean) {
    let entries: Awaited<ReturnType<typeof readdir>> = []
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        const media = underMedia || isMediaLikeDir(entry.name)
        await walk(full, media)
      } else if (entry.isFile()) {
        try {
          const s = await stat(full)
          size += s.size
          if (underMedia) mediaSize += s.size
        } catch {
          // skip
        }
      }
    }
  }

  await walk(root, false)
  return { size, mediaSize }
}

export async function listBooks(): Promise<LibraryBook[]> {
  await ensureDataDirs()
  const { downloadsDir } = getDataPaths()
  let entries: string[] = []
  try {
    entries = await readdir(downloadsDir)
  } catch {
    return []
  }

  const books: LibraryBook[] = []
  for (const name of entries) {
    const full = join(downloadsDir, name)
    try {
      const s = await stat(full)
      if (!s.isDirectory()) continue
      let hasIndex = false
      try {
        await stat(join(full, 'index.md'))
        hasIndex = true
      } catch {
        hasIndex = false
      }
      const { size, mediaSize } = await measureBookSizes(full)
      books.push({
        name,
        path: name,
        mtime: s.mtimeMs,
        hasIndex,
        size,
        mediaSize,
      })
    } catch {
      // skip
    }
  }
  return books.sort((a, b) => b.mtime - a.mtime)
}

function isDocLikeFile(name: string) {
  const ext = extname(name).toLowerCase()
  return DOC_EXTS.has(ext) || ext === '.pdf' || ext === '.zip'
}

/** list one directory level only (lazy tree) */
async function listDirLevel(dir: string, root: string): Promise<TreeNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  for (const entry of sorted) {
    if (entry.name === 'progress.json' || entry.name === '.vitepress' || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    const rel = relative(root, full).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      if (isMediaLikeDir(entry.name)) continue
      // probe if directory has any visible child without full recursive walk
      let hasVisible = false
      try {
        const kids = await readdir(full, { withFileTypes: true })
        for (const k of kids) {
          if (k.name === 'progress.json' || k.name === '.vitepress' || k.name === 'node_modules') continue
          if (k.isDirectory()) {
            if (!isMediaLikeDir(k.name)) {
              hasVisible = true
              break
            }
          } else if (isDocLikeFile(k.name)) {
            hasVisible = true
            break
          }
        }
      } catch {
        hasVisible = false
      }
      if (!hasVisible) continue
      nodes.push({
        label: entry.name,
        path: rel,
        type: 'dir',
        // lazy marker: empty array means "not loaded yet" for frontend
        children: [],
        lazy: true,
      } as TreeNode)
    } else if (isDocLikeFile(entry.name)) {
      nodes.push({
        label: entry.name,
        path: rel,
        type: 'file',
      })
    }
  }
  return nodes
}

export async function getBookTree(bookName: string, dirPath = '') {
  await ensureDataDirs()
  const name = assertBookName(bookName)
  const { downloadsDir } = getDataPaths()
  const bookRoot = resolveSafe(downloadsDir, name)
  const s = await stat(bookRoot)
  if (!s.isDirectory()) {
    throw createError({ statusCode: 404, statusMessage: '知识库不存在' })
  }
  const target = dirPath ? resolveSafe(bookRoot, dirPath) : bookRoot
  const ts = await stat(target)
  if (!ts.isDirectory()) {
    throw createError({ statusCode: 400, statusMessage: '路径不是目录' })
  }
  return {
    name,
    path: dirPath || '',
    tree: await listDirLevel(target, bookRoot),
  }
}

export async function readBookFile(bookName: string, filePath: string) {
  await ensureDataDirs()
  const name = assertBookName(bookName)
  const { downloadsDir } = getDataPaths()
  const bookRoot = resolveSafe(downloadsDir, name)
  const full = resolveSafe(bookRoot, filePath)
  const s = await stat(full)
  if (!s.isFile()) {
    throw createError({ statusCode: 404, statusMessage: '文件不存在' })
  }
  const ext = extname(full).toLowerCase()
  if (['.md', '.markdown', '.txt', '.json', '.csv'].includes(ext)) {
    const content = await readFile(full, 'utf8')
    return {
      name: basename(full),
      path: filePath,
      type: 'text' as const,
      ext,
      content,
      size: s.size,
      mtime: s.mtimeMs,
    }
  }
  return {
    name: basename(full),
    path: filePath,
    type: 'binary' as const,
    ext,
    url: `/api/files/${encodeURIComponent(name)}/${filePath.split('/').map(encodeURIComponent).join('/')}`,
    size: s.size,
    mtime: s.mtimeMs,
  }
}
export async function deleteBook(bookName: string) {
  await ensureDataDirs()
  const name = assertBookName(bookName)

  // 若有进行中任务目标该知识库，先阻止删除，避免边下边删
  try {
    const { listTasks, loadJobsIntoMemory } = await import('./store')
    await loadJobsIntoMemory()
    const tasks = listTasks()
    const active = tasks.filter((t: any) => t.status === 'running' || t.status === 'queued')
    const hit = active.find((t: any) => {
      if (Array.isArray(t.targetBooks) && t.targetBooks.map(String).includes(name)) return true
      if (t.bookName && String(t.bookName) === name) return true
      if (t.bookPath) {
        const bp = String(t.bookPath).replace(/\\/g, '/')
        if (bp.endsWith(`/${name}`) || bp.split('/').includes(name)) return true
      }
      return (t.urls || []).some((u: string) => {
        try {
          const parts = new URL(u).pathname.split('/').filter(Boolean)
          // yuque.com/{user}/{book}
          return parts[1] === name
        } catch {
          return false
        }
      })
    })
    if (hit) {
      throw createError({
        statusCode: 409,
        statusMessage: '该知识库仍有进行中的下载任务，请先取消/等待完成后再删除',
      })
    }
  } catch (e: any) {
    if (e?.statusCode === 409) throw e
    // listTasks 失败不阻断删除
  }

  const { downloadsDir } = getDataPaths()
  const bookRoot = resolveSafe(downloadsDir, name)
  let s
  try {
    s = await stat(bookRoot)
  } catch {
    throw createError({ statusCode: 404, statusMessage: '知识库不存在' })
  }
  if (!s.isDirectory()) {
    throw createError({ statusCode: 404, statusMessage: '知识库不存在' })
  }

  await rm(bookRoot, { recursive: true, force: true })
  return { ok: true, name }
}
