const ONE_MB = 1024 * 1024

export class JsonInputError extends Error {
  constructor(public readonly code: 'PAYLOAD_TOO_LARGE' | 'INVALID_JSON' | 'INVALID_TOP_LEVEL', message: string) {
    super(message)
    this.name = 'JsonInputError'
  }
}

export interface ParsedJsonInput {
  value: unknown
  byteLength: number
}

export function parseJsonInput(raw: string): ParsedJsonInput {
  const byteLength = new TextEncoder().encode(raw).length

  if (byteLength > ONE_MB) {
    throw new JsonInputError('PAYLOAD_TOO_LARGE', 'JSON payload exceeds 1 MB limit.')
  }

  let value: unknown

  try {
    value = JSON.parse(raw)
  } catch {
    throw new JsonInputError('INVALID_JSON', 'Input is not valid JSON. Fix syntax and try again.')
  }

  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new JsonInputError('INVALID_TOP_LEVEL', 'Top-level JSON value must be an object.')
  }

  return {
    value,
    byteLength
  }
}
