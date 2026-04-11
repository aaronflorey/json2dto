import { strToU8, zipSync } from 'fflate'

export interface ExportFile {
  path: string
  contents: string
}

export class ExportPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportPayloadError'
  }
}

export function validateExportFiles(input: unknown): ExportFile[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new ExportPayloadError('Export payload must include at least one file.')
  }

  return input.map((file) => {
    if (!file || typeof file !== 'object') {
      throw new ExportPayloadError('Each export file must be an object.')
    }

    const candidate = file as Partial<ExportFile>

    if (!candidate.path || !candidate.contents) {
      throw new ExportPayloadError('Each export file requires path and contents.')
    }

    if (candidate.path.includes('..') || candidate.path.startsWith('/')) {
      throw new ExportPayloadError('Export file paths must be relative and safe.')
    }

    return {
      path: candidate.path,
      contents: candidate.contents
    }
  })
}

export function buildZipArchive(files: ExportFile[]): Uint8Array {
  const safeFiles = validateExportFiles(files)
  const archiveEntries: Record<string, Uint8Array> = {}

  for (const file of safeFiles) {
    archiveEntries[file.path] = strToU8(file.contents)
  }

  return zipSync(archiveEntries, { level: 6 })
}
