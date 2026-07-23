import {
  contentDisposition,
  createBookZipStream,
  exportGate,
  exportZipName,
  resolveBookRoot,
} from '../../../utils/export-zip'
import { assertRateLimit, clientKey } from '../../../utils/rate-limit'

export default defineEventHandler(async (event) => {
  // LAN stability: export is heavy
  assertRateLimit(clientKey(event, 'export'), 3, 60_000)
  exportGate.tryEnter('已有导出任务进行中，请稍后再试')

  let released = false
  const release = () => {
    if (released) return
    released = true
    exportGate.leave()
  }

  try {
    const bookParam = getRouterParam(event, 'book')
    if (!bookParam) throw createError({ statusCode: 400, statusMessage: 'missing book' })
    const { name, bookRoot } = await resolveBookRoot(decodeURIComponent(bookParam))

    const zipName = exportZipName(name)
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', contentDisposition(zipName))
    setHeader(event, 'Cache-Control', 'no-store')

    const req = event.node.req
    req.on('close', release)
    req.on('error', release)

    const stream = await createBookZipStream(bookRoot)
    stream.on('end', release)
    stream.on('close', release)
    stream.on('error', release)

    return sendStream(event, stream)
  } catch (e) {
    release()
    throw e
  }
})
