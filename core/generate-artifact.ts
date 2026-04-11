import type { GeneratedOutput } from './contracts'
import { getDefaultGeneratorSettings, getGenerator } from './generators/registry'
import type { GeneratorSelection, GeneratorSettings } from './generators/types'
import { inferJsonTypes } from './inference/infer-types'
import { parseJsonInput } from './json/parse-json-input'

export interface GenerationResult {
  artifact: GeneratedOutput
  inference: ReturnType<typeof inferJsonTypes>
  byteLength: number
}

export interface GenerationRequest {
  rawJson: string
  target?: GeneratorSelection
  settings?: Partial<GeneratorSettings>
}

export function generateArtifactFromJson(input: GenerationRequest): GenerationResult {
  const target = input.target ?? { language: 'php', package: 'spatie/laravel-data' }
  const defaultSettings = getDefaultGeneratorSettings(target) as Record<string, unknown>
  const mergedSettings = { ...defaultSettings, ...(input.settings as Record<string, unknown> | undefined) }

  const parsed = parseJsonInput(input.rawJson)
  const rootName = typeof mergedSettings.rootName === 'string' ? mergedSettings.rootName : 'Root'
  const inference = inferJsonTypes(parsed.value, rootName)
  const generator = getGenerator(target)

  const artifact = generator.generate(
    {
      inference,
      root: inference.root
    },
    mergedSettings
  )

  return {
    artifact,
    inference,
    byteLength: parsed.byteLength
  }
}
