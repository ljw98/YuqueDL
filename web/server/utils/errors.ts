/**
 * Map raw download / network errors into actionable Chinese messages.
 */

export interface ClassifiedError {
  code:
    | 'aborted'
    | 'invalid_token'
    | 'need_password'
    | 'forbidden'
    | 'not_found'
    | 'rate_limited'
    | 'network'
    | 'invalid_url'
    | 'unknown'
  message: string
  raw: string
}

export function classifyTaskError(err: unknown): ClassifiedError {
  const anyErr = err as any
  const raw = String(anyErr?.statusMessage || anyErr?.message || anyErr || '未知错误')
  const lower = raw.toLowerCase()
  const text = raw

  if (
    anyErr?.name === 'AbortError' ||
    /abort/i.test(raw) ||
    raw === '已取消' ||
    raw === 'Download aborted'
  ) {
    return { code: 'aborted', message: '已取消', raw }
  }

  // book password
  if (
    /访问密码|需要密码|password|book password|no found book id|need.?password|加密/i.test(text) ||
    lower.includes('password')
  ) {
    // avoid false positive on unrelated "password" in stack — still prefer actionable
    if (/访问密码|需要密码|book|知识库|password required|encrypt/i.test(text) || /no found book id/i.test(text)) {
      return {
        code: 'need_password',
        message: '该知识库需要访问密码，请在下载时填写正确密码后重试',
        raw,
      }
    }
  }

  if (
    /401|unauthorized|login|cookie|token|会话|过期|无效.*token|_yuque_session|未登录/i.test(text)
  ) {
    return {
      code: 'invalid_token',
      message: 'Token 无效或已过期，请在设置中更新 _yuque_session 后重试',
      raw,
    }
  }

  if (/403|forbidden|无权限|permission|not allowed|denied/i.test(text)) {
    return {
      code: 'forbidden',
      message: '没有权限访问该内容（可能是私密库或账号无权限）',
      raw,
    }
  }

  if (/404|not found|不存在|找不到/i.test(text)) {
    return {
      code: 'not_found',
      message: '目标不存在或链接无效，请检查语雀 URL',
      raw,
    }
  }

  if (/429|rate limit|too many|限流|频繁/i.test(text)) {
    return {
      code: 'rate_limited',
      message: '请求过于频繁，已被限流，请稍后再试',
      raw,
    }
  }

  if (
    /network|enotfound|econnreset|econnrefused|etimedout|timeout|fetch failed|socket|无法连接|网络/i.test(
      text,
    )
  ) {
    return {
      code: 'network',
      message: '网络异常，无法连接语雀，请检查网络后重试',
      raw,
    }
  }

  if (/无效 url|仅支持语雀|invalid url/i.test(text)) {
    return {
      code: 'invalid_url',
      message: raw.slice(0, 180),
      raw,
    }
  }

  // keep short Chinese / readable message; strip huge stacks
  let message = raw.replace(/\s+/g, ' ').trim()
  if (message.length > 180) message = `${message.slice(0, 180)}…`
  // if looks like English stack noise, generic
  if (/^\s*Error:/i.test(message) && message.length > 80) {
    message = '下载失败，请查看日志了解详情'
  }

  return { code: 'unknown', message: message || '下载失败', raw }
}
