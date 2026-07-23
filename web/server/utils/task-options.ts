/**
 * Sanitize task options coming from external/untrusted surfaces
 * (Open API / MCP). Always use server-side yuque session token.
 *
 * Keep book `password` — it is the knowledge-base access password,
 * not the console credential.
 */
export function sanitizeExternalTaskOptions(input?: Record<string, any> | null) {
  const options = { ...(input || {}) }
  delete options.token
  delete options.key
  // do NOT delete options.password (知识库访问密码)
  return options
}
