import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
})

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
    return html
  }

  return { renderMarkdown }
}
