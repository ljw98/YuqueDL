import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, extname, basename } from 'node:path'
import { ensureDataDirs, getDataPaths, resolveSafe } from './paths'

export interface LibraryBook {
  name: string
  path: string
  mtime: number
  hasIndex: boolean
}

export interface TreeNode {
  label: string
  path: string
  type: 'dir' | 'file'
  children?: TreeNode[]
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
      books.push({
        name,
        path: name,
        mtime: s.mtimeMs,
        hasIndex,
      })
    } catch {
      // skip
    }
  }
  return books.sort((a, b) => b.mtime - a.mtime)
}

async function walk(dir: string, root: string): Promise<TreeNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })

  for (const entry of sorted) {
    if (entry.name === 'progress.json' || entry.name === '.vitepress') continue
    const full = join(dir, entry.name)
    const rel = relative(root, full).replace(/\\/g, '/')
    if (entry.isDirectory()) {
      nodes.push({
        label: entry.name,
        path: rel,
        type: 'dir',
        children: await walk(full, root),
      })
    } else {
      const ext = extname(entry.name).toLowerCase()
      if (!['.md', '.markdown', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf', '.mp4', '.json', '.txt', '.csv', '.zip'].includes(ext)) {
        continue
      }
      nodes.push({
        label: entry.name,
        path: rel,
        type: 'file',
      })
    }
  }
  return nodes
}

export async function getBookTree(bookName: string) {
  await ensureDataDirs()
  const { downloadsDir } = getDataPaths()
  const bookRoot = resolveSafe(downloadsDir, bookName)
  const s = await stat(bookRoot)
  if (!s.isDirectory()) {
    throw createError({ statusCode: 404, statusMessage: '知识库不存在' })
  }
  return {
    name: bookName,
    tree: await walk(bookRoot, bookRoot),
  }
}

export async function readBookFile(bookName: string, filePath: string) {
  await ensureDataDirs()
  const { downloadsDir } = getDataPaths()
  const bookRoot = resolveSafe(downloadsDir, bookName)
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
    url: `/api/files/${encodeURIComponent(bookName)}/${filePath.split('/').map(encodeURIComponent).join('/')}`,
    size: s.size,
    mtime: s.mtimeMs,
  }
}
