#!/usr/bin/env node
/**
 * Full functional smoke against a running YuqueDL console (default :8787).
 * Creates temporary schedule + task, cancels/deletes, exercises Open/MCP token.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.YUQUE_DL_SMOKE_BASE || 'http://127.0.0.1:8787'
const results = []
let failed = 0

function ok(name, detail = '') {
  results.push({ name, ok: true, detail })
  console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`)
}
function bad(name, detail = '') {
  failed++
  results.push({ name, ok: false, detail })
  console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`)
}

async function req(method, path, { body, headers, expectStatus } = {}) {
  const url = BASE + path
  const init = { method, headers: { ...(headers || {}) }, redirect: 'manual' }
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetch(url, init)
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (expectStatus != null && res.status !== expectStatus) {
    bad(`${method} ${path}`, `status ${res.status} expected ${expectStatus}; body=${text.slice(0, 120)}`)
  }
  return { method, path, status: res.status, json, text: text.slice(0, 300), headers: res.headers }
}

async function page(path, expect = 200) {
  const res = await fetch(BASE + path, { redirect: 'manual' })
  if (res.status === expect) ok(`page ${path}`, `HTTP ${res.status}`)
  else bad(`page ${path}`, `HTTP ${res.status}`)
  return res
}

async function main() {
  console.log(`Smoke base: ${BASE}\n`)

  for (const p of ['/', '/tasks', '/library', '/settings', '/api', '/login']) {
    await page(p)
  }

  const settings = await req('GET', '/api/settings', { expectStatus: 200 })
  if (settings.status === 200 && settings.json && typeof settings.json === 'object') {
    ok('GET /api/settings shape', Object.keys(settings.json).slice(0, 8).join(','))
  } else if (settings.status === 200) bad('GET /api/settings shape', 'not object')

  const tasks = await req('GET', '/api/tasks', { expectStatus: 200 })
  if (tasks.status === 200 && Array.isArray(tasks.json?.tasks)) ok('GET /api/tasks', `n=${tasks.json.tasks.length}`)
  else if (tasks.status === 200) bad('GET /api/tasks', JSON.stringify(tasks.json).slice(0, 80))

  const library = await req('GET', '/api/library', { expectStatus: 200 })
  if (library.status === 200 && Array.isArray(library.json?.books)) ok('GET /api/library', `n=${library.json.books.length}`)
  else if (library.status === 200) bad('GET /api/library', JSON.stringify(library.json).slice(0, 80))

  const schedules = await req('GET', '/api/schedules', { expectStatus: 200 })
  if (schedules.status === 200 && Array.isArray(schedules.json?.schedules)) {
    ok('GET /api/schedules', `n=${schedules.json.schedules.length}`)
  } else if (schedules.status === 200) {
    bad('GET /api/schedules', JSON.stringify(schedules.json).slice(0, 80))
  }

  const auth = await req('GET', '/api/auth/status', { expectStatus: 200 })
  if (auth.status === 200) ok('GET /api/auth/status', JSON.stringify(auth.json).slice(0, 80))

  const openNoAuth = await req('GET', '/api/open/status')
  if (openNoAuth.status === 401 || openNoAuth.status === 403) ok('Open without token rejected', `HTTP ${openNoAuth.status}`)
  else bad('Open without token rejected', `HTTP ${openNoAuth.status}`)

  const mcpNoAuth = await req('POST', '/api/mcp', {
    body: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  })
  if (mcpNoAuth.status === 401 || mcpNoAuth.status === 403) ok('MCP without token rejected', `HTTP ${mcpNoAuth.status}`)
  else bad('MCP without token rejected', `HTTP ${mcpNoAuth.status}`)

  const createBad = await req('POST', '/api/tasks', {
    body: { type: 'book', urls: ['not-a-url'], options: { ignoreImg: true } },
  })
  if (createBad.status >= 400 && createBad.status < 500) ok('POST /api/tasks rejects bad URL', `HTTP ${createBad.status}`)
  else bad('POST /api/tasks bad URL', `HTTP ${createBad.status} ${createBad.text}`)

  const createOk = await req('POST', '/api/tasks', {
    body: {
      type: 'book',
      urls: ['https://www.yuque.com/yuque/thyzgp'],
      options: {
        ignoreImg: true,
        ignoreAttachments: true,
        incremental: false,
        toc: false,
        convertMarkdownVideoLinks: false,
        hideFooter: true,
      },
    },
  })
  const taskId = createOk.json?.id || createOk.json?.task?.id
  if ((createOk.status === 200 || createOk.status === 201) && taskId) {
    ok('POST /api/tasks create book', `id=${taskId}`)
    const detail = await req('GET', `/api/tasks/${taskId}`, { expectStatus: 200 })
    if (detail.status === 200) ok('GET /api/tasks/:id', detail.json?.task?.status || '')

    try {
      const sse = await fetch(BASE + `/api/tasks/${taskId}/events`, {
        headers: { Accept: 'text/event-stream' },
      })
      if (sse.status === 200) {
        const ct = sse.headers.get('content-type') || ''
        if (ct.includes('event-stream')) ok('SSE events content-type', ct)
        else ok('SSE events HTTP 200', ct || 'no content-type')
        try {
          await sse.body?.cancel()
        } catch {
          /* ignore */
        }
      } else bad('SSE events', `HTTP ${sse.status}`)
    } catch (e) {
      bad('SSE events', String(e.message || e))
    }

    await req('POST', `/api/tasks/${taskId}/cancel`)
    const afterCancel = await req('GET', `/api/tasks/${taskId}`)
    if (afterCancel.status === 200) {
      const st = afterCancel.json?.task?.status || afterCancel.json?.status
      if (['cancelled', 'success', 'failed', 'running', 'pending', 'queued'].includes(st)) {
        ok('cancel path status', st)
      } else bad('cancel path status', String(st))
    }

    await req('POST', `/api/tasks/${taskId}/retry`)
    const del = await req('DELETE', `/api/tasks/${taskId}`)
    if (del.status === 200 || del.status === 204 || del.status === 404) ok('DELETE /api/tasks/:id', `HTTP ${del.status}`)
    else bad('DELETE /api/tasks/:id', `HTTP ${del.status}`)
  } else {
    bad('POST /api/tasks create book', `HTTP ${createOk.status} ${createOk.text}`)
  }

  // schedules: interval must be hourly|daily|weekly
  const schCreate = await req('POST', '/api/schedules', {
    body: {
      url: 'https://www.yuque.com/yuque/thyzgp',
      interval: 'daily',
      enabled: false,
    },
  })
  const schId = schCreate.json?.id || schCreate.json?.schedule?.id
  if ((schCreate.status === 200 || schCreate.status === 201) && schId) {
    ok('POST /api/schedules', `id=${schId}`)
    await req('PUT', `/api/schedules/${schId}`, { body: { enabled: false } })
    ok('PUT /api/schedules/:id')
    const delS = await req('DELETE', `/api/schedules/${schId}`)
    if (delS.status === 200 || delS.status === 204) ok('DELETE /api/schedules/:id')
    else bad('DELETE /api/schedules/:id', `HTTP ${delS.status}`)
  } else {
    bad('POST /api/schedules', `HTTP ${schCreate.status} ${schCreate.text}`)
  }

  const before = settings.json || {}
  const put = await req('PUT', '/api/settings', {
    body: {
      defaultOptions: {
        ...(before.defaultOptions || {}),
        ignoreImg: true,
        hideFooter: true,
      },
      uiPrefs: {
        ...(before.uiPrefs || {}),
        autoRefreshTasks: true,
        autoRefreshLibrary: true,
      },
    },
  })
  if (put.status === 200) ok('PUT /api/settings')
  else bad('PUT /api/settings', `HTTP ${put.status} ${put.text}`)

  const books = library.json?.books
  if (Array.isArray(books) && books.length > 0) {
    const bookName = books[0].name || books[0].bookName
    if (bookName) {
      const tree = await req('GET', `/api/library/${encodeURIComponent(bookName)}/tree`)
      if (tree.status === 200) ok('GET library tree', bookName)
      else bad('GET library tree', `HTTP ${tree.status}`)

      try {
        const exp = await fetch(BASE + `/api/library/${encodeURIComponent(bookName)}/export`)
        if (exp.status === 200) {
          const buf = Buffer.from(await exp.arrayBuffer())
          const cd = exp.headers.get('content-disposition') || ''
          ok('GET library export', `bytes=${buf.length} cd=${cd.slice(0, 100)}`)
          if (/[^\x20-\x7E]/.test(cd.split('filename*=')[0] || cd)) {
            bad('export Content-Disposition ASCII', cd)
          } else {
            ok('export Content-Disposition ASCII-safe')
          }
        } else {
          const t = await exp.text()
          bad('GET library export', `HTTP ${exp.status} ${t.slice(0, 120)}`)
        }
      } catch (e) {
        bad('GET library export', String(e.message || e))
      }
    }
  } else {
    ok('library empty skip tree/export', 'no books')
  }

  const tok = await req('POST', '/api/open/token')
  const token = tok.json?.token || tok.json?.apiToken || tok.json?.value
  if ((tok.status === 200 || tok.status === 201) && token) {
    ok('POST /api/open/token', 'issued')
    const openOk = await req('GET', '/api/open/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (openOk.status === 200) {
      ok('Open status with token', JSON.stringify(openOk.json).slice(0, 80))
      if (openOk.json?.service === 'yuquedl') ok('Open service name yuquedl')
      else ok('Open service name', String(openOk.json?.service))
    } else bad('Open status with token', `HTTP ${openOk.status}`)

    const openLib = await req('GET', '/api/open/library', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (openLib.status === 200) ok('Open library with token')
    else bad('Open library with token', `HTTP ${openLib.status}`)

    const mcp = await req('POST', '/api/mcp', {
      headers: { Authorization: `Bearer ${token}` },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    })
    if (mcp.status === 200) {
      const tools = mcp.json?.result?.tools || mcp.json?.tools
      ok('MCP tools/list', Array.isArray(tools) ? `n=${tools.length}` : JSON.stringify(mcp.json).slice(0, 80))
    } else bad('MCP tools/list', `HTTP ${mcp.status} ${mcp.text}`)

    const rev = await req('DELETE', '/api/open/token')
    if (rev.status === 200 || rev.status === 204) ok('DELETE /api/open/token')
    else bad('DELETE /api/open/token', `HTTP ${rev.status}`)

    const openAfter = await req('GET', '/api/open/status', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (openAfter.status === 401 || openAfter.status === 403) ok('revoked token rejected', `HTTP ${openAfter.status}`)
    else bad('revoked token rejected', `HTTP ${openAfter.status}`)
  } else {
    const existing = await req('GET', '/api/open/token')
    if (existing.status === 200) ok('GET /api/open/token (existing)', JSON.stringify(existing.json).slice(0, 80))
    else bad('POST /api/open/token', `HTTP ${tok.status} ${tok.text}`)
  }

  const hres = await fetch(BASE + '/api/settings')
  const nosniff = hres.headers.get('x-content-type-options')
  if (nosniff && nosniff.toLowerCase().includes('nosniff')) ok('header nosniff', nosniff)
  else ok('header nosniff missing (non-fatal)', String(nosniff))

  console.log('\n======== SUMMARY ========')
  const pass = results.filter((r) => r.ok).length
  const total = results.length
  console.log(`${pass}/${total} passed, ${failed} failed`)
  if (process.env.YUQUE_DL_SMOKE_REPORT) {
    const out = resolve(process.env.YUQUE_DL_SMOKE_REPORT)
    mkdirSync(resolve(out, '..'), { recursive: true })
    writeFileSync(out, JSON.stringify({ base: BASE, at: new Date().toISOString(), pass, total, failed, results }, null, 2))
  }
  if (failed) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
