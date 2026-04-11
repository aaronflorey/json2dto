import { ExportPayloadError, validateExportFiles } from '../../../core/export/export-payload'

interface Body {
  files: Array<{ path: string, contents: string }>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)

  try {
    const files = validateExportFiles(body?.files)
    const file = files[0]

    if (!file) {
      throw new ExportPayloadError('No file provided for download.')
    }

    const filename = file.path.split('/').at(-1) ?? 'dto.php'
    setHeader(event, 'Content-Type', 'application/octet-stream')
    setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

    return file.contents
  } catch (error) {
    if (error instanceof ExportPayloadError) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message
      })
    }

    throw createError({ statusCode: 500, statusMessage: 'Unable to export file.' })
  }
})
