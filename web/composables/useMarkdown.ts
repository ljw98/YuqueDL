import MarkdownIt from 'markdown-it'

// Disable raw HTML to reduce XSS risk when rendering untrusted markdown.
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const ALLOWED_TAGS = new Set([
  'a', 'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'code', 'pre',
  'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div',
])

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'data-yuque-link',
])

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeUrl(url: string, kind: 'href' | 'src') {
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

/** Lightweight HTML sanitizer (no external dependency). */
export function sanitizeHtml(input: string) {
  if (!input) return ''
  let html = String(input)
  // drop script/style entirely
  html = html.replace(/<\/(?:script|style)[^>]*>/gi, '')
  html = html.replace(/<(script|style)(\s[^>]*)?>[\s\S]*?<\/\1>/gi, '')
  html = html.replace(/<(script|style)(\s[^>]*)?\/?>/gi, '')
  // neutralize event handlers / javascript: urls early
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  html = html.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=""')

  return html.replace(/<\/?([a-zA-Z0-9-]+)(\s[^>]*)?>/g, (full, rawTag: string, rawAttrs = '') => {
    const isClose = full.startsWith('</')
    const tag = String(rawTag || '').toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      return escapeHtml(full)
    }
    if (isClose) return `</${tag}>`

    const attrs: string[] = []
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
    let m: RegExpExecArray | null
    while ((m = attrRe.exec(String(rawAttrs || '')))) {
      const name = m[1].toLowerCase()
      if (!ALLOWED_ATTRS.has(name)) continue
      const value = m[3] ?? m[4] ?? m[5] ?? ''
      if (name === 'href' || name === 'src') {
        const safe = sanitizeUrl(value, name)
        if (!safe) continue
        attrs.push(`${name}="${escapeHtml(safe)}"`)
        if (name === 'href' && /^https?:\/\//i.test(safe)) {
          attrs.push('rel="noopener noreferrer"')
        }
      } else {
        attrs.push(`${name}="${escapeHtml(value)}"`)
      }
    }
    return attrs.length ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`
  })
}

function resolveRelative(baseDir: string, rel: string) {
  const cleaned = rel.replace(/^\.\//, '')
  const parts = [...(baseDir ? baseDir.split('/') : []), ...cleaned.split('/')]
  const stack: string[] = []
  for (const p of parts) {
    if (!p || p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  return stack.join('/')
}

export function useMarkdown() {
  function renderMarkdown(source: string, bookName?: string, filePath?: string) {
    let html = md.render(source || '')
    if (bookName && filePath) {
      const dir = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : ''
      html = html.replace(/(<img[^>]+src=["'])([^"']+)(["'])/gi, (_m, p1, src, p3) => {
        if (/^(https?:|data:|\/)/i.test(src)) return `${p1}${src}${p3}`
        const abs = [bookName, resolveRelative(dir, src)].filter(Boolean).join('/')
        return `${p1}/api/files/${abs.split('/').map(encodeURIComponent).join('/')}${p3}`
      })
      // 站内相对 md 链接 → 交给预览器处理
      html = html.replace(/(<a[^>]+href=["'])([^"']+)(["'][^>]*>)/gi, (_m, p1, href, p3) => {
        if (/^(https?:|mailto:|#|\/)/i.test(href)) return `${p1}${href}${p3}`
        if (!/\.(md|markdown)(\?|#|$)/i.test(href)) return `${p1}${href}${p3}`
        const target = resolveRelative(dir, href.split(/[?#]/)[0])
        return `${p1}#${target}${p3.replace(/>$/, ' data-yuque-link="1">')}`
      })
    }
    return sanitizeHtml(html)
  }

  return { renderMarkdown, sanitizeHtml }
}
