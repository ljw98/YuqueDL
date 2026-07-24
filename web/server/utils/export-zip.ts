/**
 * Shared library ZIP export helpers (console / Open API / MCP).
 * - Prefer system `zip` streaming; fallback to store-method stream (one file at a time).
 * - Global concurrency gate: only 1 export at a time.
 */
import { createWriteStream, existsSync, statSync } from 'node:fs'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { PassThrough, type Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { assertBookName } from './library'
import { ensureDataDirs, getDataPaths, resolveSafe } from './paths'
import { createConcurrencyGate } from './rate-limit'

export const exportGate = createConcurrencyGate('library-export', 1)

/**
 * Node rejects non-ASCII / control chars in header *values* for the legacy
 * `filename="..."` token. Keep ASCII fallback there; put real name in
 * RFC 5987 `filename*`.
 */
export function contentDisposition(filename: string) {
  const raw = String(filename || 'download.zip')
  let asciiName = raw
    .replace(/["\\\r\n]/g, '_')
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.\s-]+|[_.\s-]+$/g, '')

  // Fully non-ASCII book names strip to leftovers like "2026-07-24.zip".
  // Ignore the ".zip" suffix when checking for Latin letters (extension alone
  // must not count as a meaningful ASCII basename).
  const asciiBase = asciiName.replace(/\.zip$/i, '')
  if (!asciiName || asciiName === '.zip' || !/[A-Za-z]/.test(asciiBase)) {
    const m = raw.match(/(\d{4}-\d{2}-\d{2})(?:\.zip)?$/i)
    asciiName = m ? `book-${m[1]}.zip` : 'download.zip'
  } else if (!/\.zip$/i.test(asciiName)) {
    asciiName = `${asciiName}.zip`
  }

  const encoded = encodeURIComponent(raw)
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`
}

export function exportZipName(bookName: string, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  // Keep original book name for filename* / clients that parse it; header
  // builder will ASCII-sanitize the legacy filename= token.
  return `${bookName}-${stamp}.zip`
}

export async function resolveBookRoot(bookName: string) {
  await ensureDataDirs()
  const name = assertBookName(bookName)
  const { downloadsDir } = getDataPaths()
  const bookRoot = resolveSafe(downloadsDir, name)
  if (!existsSync(bookRoot) || !statSync(bookRoot).isDirectory()) {
    throw createError({ statusCode: 404, statusMessage: '知识库不存在' })
  }
  return { name, bookRoot, downloadsDir }
}

async function collectFiles(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string) {
    let entries: string[] = []
    try {
      entries = await readdir(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const full = join(dir, name)
      let s
      try {
        s = await stat(full)
      } catch {
        continue
      }
      if (s.isDirectory()) await walk(full)
      else if (s.isFile()) out.push(full)
    }
  }
  await walk(root)
  return out
}

function crc32(buf: Buffer) {
  let crc = ~0
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return ~crc
}

function u16(n: number) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n, 0)
  return b
}

function u32(n: number) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n >>> 0, 0)
  return b
}

/** Stream store-method ZIP; only one file payload held for CRC. */
export function buildStoreZipStream(bookRoot: string): Readable {
  const out = new PassThrough()
  const gpFlags = 0x0800 // UTF-8 filenames (EFS)

  ;(async () => {
    try {
      const files = await collectFiles(bookRoot)
      const central: Buffer[] = []
      let offset = 0

      for (const full of files) {
        const rel = relative(bookRoot, full).split(sep).join('/')
        if (!rel || rel.startsWith('..')) continue
        const content = await readFile(full)
        const nameBuf = Buffer.from(rel, 'utf8')
        const crc = crc32(content)
        const localHeader = Buffer.concat([
          u32(0x04034b50),
          u16(20),
          u16(gpFlags),
          u16(0),
          u16(0),
          u16(0),
          u32(crc >>> 0),
          u32(content.length),
          u32(content.length),
          u16(nameBuf.length),
          u16(0),
          nameBuf,
        ])
        if (!out.write(localHeader)) {
          await new Promise<void>((r) => out.once('drain', () => r()))
        }
        if (!out.write(content)) {
          await new Promise<void>((r) => out.once('drain', () => r()))
        }

        const centralHeader = Buffer.concat([
          u32(0x02014b50),
          u16(20),
          u16(20),
          u16(gpFlags),
          u16(0),
          u16(0),
          u16(0),
          u32(crc >>> 0),
          u32(content.length),
          u32(content.length),
          u16(nameBuf.length),
          u16(0),
          u16(0),
          u16(0),
          u16(0),
          u32(0),
          u32(offset),
          nameBuf,
        ])
        central.push(centralHeader)
        offset += localHeader.length + content.length
      }

      const centralDir = Buffer.concat(central)
      const end = Buffer.concat([
        u32(0x06054b50),
        u16(0),
        u16(0),
        u16(central.length),
        u16(central.length),
        u32(centralDir.length),
        u32(offset),
        u16(0),
      ])
      out.write(centralDir)
      out.write(end)
      out.end()
    } catch (e: any) {
      out.destroy(e instanceof Error ? e : new Error(String(e)))
    }
  })()

  return out
}

export function trySystemZipStream(bookRoot: string) {
  return new Promise<Readable | null>((resolvePromise) => {
    let settled = false
    let child: ReturnType<typeof spawn>
    try {
      child = spawn('zip', ['-r', '-q', '-UN=UTF8', '-', '.'], {
        cwd: bookRoot,
        env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch {
      resolvePromise(null)
      return
    }

    const fail = () => {
      if (settled) return
      settled = true
      try {
        child.kill('SIGTERM')
      } catch {
        // ignore
      }
      resolvePromise(null)
    }

    child.once('error', fail)
    if (!child.stdout) {
      fail()
      return
    }

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolvePromise(child.stdout)
    }, 30)

    child.stdout.once('readable', () => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      resolvePromise(child.stdout)
    })
    child.stdout.once('end', () => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      resolvePromise(child.stdout)
    })
  })
}

export async function createBookZipStream(bookRoot: string): Promise<Readable> {
  const systemStream = await trySystemZipStream(bookRoot)
  return systemStream || buildStoreZipStream(bookRoot)
}

export type MaterializedExport = {
  book: string
  zipName: string
  size: number
  /** absolute path on disk */
  filePath: string
  /** Open API path (needs Bearer) */
  downloadPath: string
  engine: 'system-zip' | 'store-zip'
}

/**
 * Build ZIP under data/exports/ for MCP / offline handoff.
 * Shares the same global export gate as HTTP export.
 */
export async function materializeBookExport(bookName: string): Promise<MaterializedExport> {
  exportGate.tryEnter('已有导出任务进行中，请稍后再试')
  try {
    const { name, bookRoot } = await resolveBookRoot(bookName)
    const { dataDir } = getDataPaths()
    const exportsDir = resolve(dataDir, 'exports')
    await mkdir(exportsDir, { recursive: true })

    const zipName = exportZipName(name)
    // zipName is controlled (asserted book + date); still resolve under exportsDir
    const filePath = resolveSafe(exportsDir, zipName)

    // Prefer system zip to file (faster, lower peak memory)
    let engine: MaterializedExport['engine'] = 'store-zip'
    let usedSystem = false
    try {
      usedSystem = await new Promise<boolean>((resolvePromise) => {
        let child: ReturnType<typeof spawn>
        try {
          child = spawn(
            'zip',
            ['-r', '-q', '-UN=UTF8', filePath, '.'],
            {
              cwd: bookRoot,
              env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' },
              stdio: ['ignore', 'ignore', 'pipe'],
            },
          )
        } catch {
          resolvePromise(false)
          return
        }
        child.once('error', () => resolvePromise(false))
        child.once('close', (code) => resolvePromise(code === 0))
      })
    } catch {
      usedSystem = false
    }

    if (usedSystem && existsSync(filePath)) {
      engine = 'system-zip'
    } else {
      const stream = buildStoreZipStream(bookRoot)
      await pipeline(stream, createWriteStream(filePath))
      engine = 'store-zip'
    }

    const s = await stat(filePath)
    return {
      book: name,
      zipName,
      size: s.size,
      filePath,
      downloadPath: `/api/open/library/${encodeURIComponent(name)}/export`,
      engine,
    }
  } finally {
    exportGate.leave()
  }
}
