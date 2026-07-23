import assert from 'node:assert/strict'

/** mirror of server/utils/task-options.ts for smoke contract */
function sanitizeExternalTaskOptions(input) {
  const options = { ...(input || {}) }
  delete options.token
  delete options.key
  return options
}

const out = sanitizeExternalTaskOptions({
  token: 'secret-session',
  key: '_yuque_session',
  password: 'book-pass',
  ignoreImg: true,
  incremental: true,
})

assert.equal(out.token, undefined)
assert.equal(out.key, undefined)
assert.equal(out.password, 'book-pass')
assert.equal(out.ignoreImg, true)
assert.equal(out.incremental, true)

const empty = sanitizeExternalTaskOptions(null)
assert.deepEqual(empty, {})

console.log('task-options tests passed')
