import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Lightweight self-check without ts compile: duplicate core rules inline for CI
// Real logic lives in server/utils/errors.ts — keep this as smoke contract.

function classify(raw) {
  const text = String(raw || '')
  const lower = text.toLowerCase()
  if (/abort/i.test(text)) return 'aborted'
  if (/访问密码|需要密码|no found book id|password required/i.test(text)) return 'need_password'
  if (/401|unauthorized|token|cookie|_yuque_session/i.test(text)) return 'invalid_token'
  if (/403|forbidden|无权限/i.test(text)) return 'forbidden'
  if (/404|not found/i.test(text)) return 'not_found'
  if (/429|rate limit|限流/i.test(text)) return 'rate_limited'
  if (/network|enotfound|etimedout|timeout|econnreset/i.test(text)) return 'network'
  return 'unknown'
}

const cases = [
  ['Download aborted', 'aborted'],
  ['Token invalid cookie expired', 'invalid_token'],
  ['该知识库需要访问密码', 'need_password'],
  ['403 Forbidden', 'forbidden'],
  ['404 Not Found', 'not_found'],
  ['429 Too Many Requests', 'rate_limited'],
  ['connect ETIMEDOUT', 'network'],
  ['something else', 'unknown'],
]

let fail = 0
for (const [input, expect] of cases) {
  const got = classify(input)
  if (got !== expect) {
    console.error('FAIL', input, '=>', got, 'expected', expect)
    fail++
  } else {
    console.log('OK', expect)
  }
}
if (fail) process.exit(1)
console.log('classify-error smoke OK')
