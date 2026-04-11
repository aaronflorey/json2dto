import { generateArtifactFromJson } from '../../core/generate-artifact'
import { GeneratorNotSupportedError } from '../../core/generators/registry'
import type { GeneratorSelection, GeneratorSettings } from '../../core/generators/types'
import { JsonInputError } from '../../core/json/parse-json-input'

interface GenerateBody {
  json: string
  target?: GeneratorSelection
  settings?: Partial<GeneratorSettings>
}

export default defineEventHandler(async (event) => {
  const body = await readBody<GenerateBody>(event)

  if (!body?.json || typeof body.json !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Field "json" is required and must be a string.'
    })
  }

  try {
    const result = generateArtifactFromJson({
      rawJson: body.json,
      target: body.target,
      settings: body.settings
    })

    return {
      artifact: result.artifact,
      inference: result.inference,
      diagnostics: {
        byteLength: result.byteLength,
        persisted: false
      }
    }
  } catch (error) {
    if (error instanceof JsonInputError) {
      throw createError({
        statusCode: error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400,
        statusMessage: error.message,
        data: {
          code: error.code
        }
      })
    }

    if (error instanceof GeneratorNotSupportedError) {
      throw createError({
        statusCode: 400,
        statusMessage: error.message
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate output.'
    })
  }
})
