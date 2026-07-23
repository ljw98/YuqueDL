import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getDataPaths } from './paths'

const TOKEN_PREFIX = 'enc:v1:'
const SESSION_COOKIE = 'yuque_dl_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

let cachedSecret: Buffer | null = null

function b64url(buf: Buffer) {
  return buf.toString('base64url')
}

function fromB64url(text: string) {
  return Buffer.from(text, 'base64url')
}

export function getSessionCookieName() {
  return SESSION_COOKIE
}

async function ensureSecretFile(): Promise<Buffer> {
  if (cachedSecret) return cachedSecret
  const config = useRuntimeConfig()
  const envSecret = String(config.authSecret || process.env.YUQUE_DL_SECRET || '').trim()
  if (envSecret) {
    cachedSecret = createHmac('sha256', 'yuque-dl-secret').update(envSecret).digest()
    return cachedSecret
  }

  const { dataDir } = getDataPaths()
  const secretPath = `${dataDir}/.secret`
  await mkdir(dirname(secretPath), { recursive: true })
  try {
    const raw = await readFile(secretPath)
    if (raw.length >= 16) {
      cachedSecret = raw
      await chmod(secretPath, 0o600).catch(() => undefined)
      return cachedSecret
    }
  } catch {
    // create below
  }

  const secret = randomBytes(32)
  await writeFile(secretPath, secret, { mode: 0o600 })
  await chmod(secretPath, 0o600).catch(() => undefined)
  cachedSecret = secret
  return cachedSecret
}

export async function getSecretKey() {
  return ensureSecretFile()
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 32)
  return `scrypt$${b64url(salt)}$${b64url(hash)}`
}

export async function verifyPassword(password: string, stored?: string) {
  if (!stored) return false
  const envPassword = String(useRuntimeConfig().accessPassword || process.env.YUQUE_DL_ACCESS_PASSWORD || '')
  if (envPassword && password === envPassword) return true

  const parts = String(stored).split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    // legacy plain fallback removed for security; force reset password if old format remains
    return false
  }
  const salt = fromB64url(parts[1])
  const expected = fromB64url(parts[2])
  const actual = scryptSync(password, salt, expected.length)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export async function encryptSecret(plain?: string) {
  const text = String(plain || '')
  if (!text) return ''
  if (text.startsWith(TOKEN_PREFIX)) return text
  const key = (await getSecretKey()).subarray(0, 32)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${TOKEN_PREFIX}${b64url(iv)}$${b64url(tag)}$${b64url(enc)}`
}

export async function decryptSecret(value?: string) {
  const text = String(value || '')
  if (!text) return ''
  if (!text.startsWith(TOKEN_PREFIX)) return text
  try {
    const body = text.slice(TOKEN_PREFIX.length)
    const [ivB64, tagB64, dataB64] = body.split('$')
    if (!ivB64 || !tagB64 || !dataB64) return ''
    const key = (await getSecretKey()).subarray(0, 32)
    const decipher = createDecipheriv('aes-256-gcm', key, fromB64url(ivB64))
    decipher.setAuthTag(fromB64url(tagB64))
    const dec = Buffer.concat([decipher.update(fromB64url(dataB64)), decipher.final()])
    return dec.toString('utf8')
  } catch {
    return ''
  }
}

export async function createSessionToken() {
  const secret = await getSecretKey()
  const payload = {
    v: 1,
    exp: Date.now() + SESSION_TTL_MS,
    n: b64url(randomBytes(8)),
  }
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export async function verifySessionToken(token?: string) {
  if (!token || !token.includes('.')) return false
  const [body, sig] = token.split('.')
  if (!body || !sig) return false
  const secret = await getSecretKey()
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as { exp?: number }
    if (!payload.exp || Date.now() > payload.exp) return false
    return true
  } catch {
    return false
  }
}

export async function secureWriteJson(filePath: string, data: unknown) {
  const json = JSON.stringify(data, null, 2)
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, json, { mode: 0o600 })
  await chmod(tmp, 0o600).catch(() => undefined)
  const { rename } = await import('node:fs/promises')
  await rename(tmp, filePath)
  await chmod(filePath, 0o600).catch(() => undefined)
}


export function generateApiToken() {
  // ydl_ + 32 bytes base64url
  return `ydl_${b64url(randomBytes(32))}`
}

export async function hashApiToken(token: string) {
  return hashPassword(token)
}

export async function verifyApiToken(token: string, stored?: string) {
  if (!token || !stored) return false
  // dedicated scrypt check — do not accept web access password env fallback
  const parts = String(stored).split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  const salt = fromB64url(parts[1])
  const expected = fromB64url(parts[2])
  const actual = scryptSync(token, salt, expected.length)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export function maskApiToken(token?: string) {
  const t = String(token || '')
  if (!t) return ''
  if (t.length <= 12) return '********'
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}
