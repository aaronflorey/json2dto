import { buildZipArchive, ExportPayloadError } from '../../../core/export/export-payload'

interface Body {
  files: Array<{ path: string, contents: string }>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  try {
    const archive = buildZipArchive(body?.files)

    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', 'attachment; filename="dto-files.zip"')

    return archive
  } catch (error) {
    if (error instanceof ExportPayloadError) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message
      })
    }

    throw createError({ statusCode: 500, statusMessage: 'Unable to export ZIP archive.' })
  }
})
