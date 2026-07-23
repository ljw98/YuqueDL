import assert from 'node:assert/strict'
import { mkdir, rm, writeFile, readFile, chmod, rename } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeUrl(url, kind) {
  const value = String(url || '').trim()
  if (!value) return ''
  if (value.startsWith('#')) return value
  if (value.startsWith('/')) return value
  if (value.startsWith('./') || value.startsWith('../')) return value
  if (/^https?:\/\//i.test(value)) return value
  if (/^mailto:/i.test(value) && kind === 'href') return value
  if (/^data:image\//i.test(value) && kind === 'src') return value
  return ''
}

function isHttpUrl(url) {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function isLikelyYuqueUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'yuque.com' || host.endsWith('.yuque.com')
  } catch {
    return false
  }
}

assert.equal(sanitizeUrl('javascript:alert(1)', 'href'), '')
assert.equal(sanitizeUrl('https://yuque.com/a', 'href'), 'https://yuque.com/a')
assert.equal(escapeHtml('<script>'), '&lt;script&gt;')
assert.equal(isHttpUrl('https://www.yuque.com/a/b'), true)
assert.equal(isHttpUrl('ftp://yuque.com/a'), false)
assert.equal(isLikelyYuqueUrl('https://www.yuque.com/a/b'), true)
assert.equal(isLikelyYuqueUrl('https://example.com/a'), false)

const tmpDir = resolve(dirname(fileURLToPath(import.meta.url)), '../.tmp-test-write')
await rm(tmpDir, { recursive: true, force: true })
await mkdir(tmpDir, { recursive: true })
const target = resolve(tmpDir, 'demo.json')
const tmp = `${target}.tmp`
await writeFile(tmp, JSON.stringify({ ok: true }), { mode: 0o600 })
await chmod(tmp, 0o600)
await rename(tmp, target)
const raw = await readFile(target, 'utf8')
assert.equal(JSON.parse(raw).ok, true)
await rm(tmpDir, { recursive: true, force: true })

console.log('security-basics tests passed')


// book name validation
function assertBookName(bookName) {
  const name = decodeURIComponent(String(bookName || '')).trim()
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('invalid')
  }
  return name
}
function expectThrow(fn) {
  try { fn(); throw new Error('expected throw') } catch (e) {
    if (String(e.message) === 'expected throw') throw e
  }
}
assert.equal(assertBookName('NASBox'), 'NASBox')
expectThrow(() => assertBookName('..'))
expectThrow(() => assertBookName('a/b'))

function guessBookNamesFromUrls(urls) {
  const names = []
  for (const url of urls || []) {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean)
      if (parts.length >= 2) names.push(parts[1])
    } catch {}
  }
  return [...new Set(names.filter(Boolean))]
}
assert.deepEqual(
  guessBookNamesFromUrls(['https://www.yuque.com/user/book1/doc', 'https://www.yuque.com/user/book2']),
  ['book1', 'book2'],
)

function clampConcurrency(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 1
  return Math.min(3, Math.max(1, Math.floor(v)))
}
assert.equal(clampConcurrency(99), 3)
assert.equal(clampConcurrency(0), 1)
assert.equal(clampConcurrency(2), 2)

console.log('extra validation tests passed')
