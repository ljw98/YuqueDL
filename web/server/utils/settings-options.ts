/** Normalize ignoreAttachments for persistence / core:
 * - true  → ignore all attachments
 * - "mp4,pdf" → ignore those extensions only
 * - false / empty → download all
 */
export function normalizeIgnoreAttachments(value: unknown): boolean | string {
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value == null || value === '') return false
  if (typeof value === 'string') {
    const cleaned = value
      .split(/[,，\s]+/)
      .map((part) => part.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean)
    return cleaned.length ? cleaned.join(',') : false
  }
  return Boolean(value)
}

export function publicIgnoreAttachments(value: unknown): boolean | string {
  return normalizeIgnoreAttachments(value)
}
