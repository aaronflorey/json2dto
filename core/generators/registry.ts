import type { Generator, GeneratorSelection } from './types'
import { crellSerdeGenerator } from './crell-serde'
import { cuyzValinorGenerator } from './cuyz-valinor'
import { laravelDataGenerator } from './spatie-laravel-data'
import { typescriptNativeGenerator } from './typescript-native'

type AnyGenerator = Generator<unknown>

const REGISTRY = new Map<string, AnyGenerator>([
  [generatorKey(laravelDataGenerator.id), laravelDataGenerator],
  [generatorKey(crellSerdeGenerator.id), crellSerdeGenerator],
  [generatorKey(cuyzValinorGenerator.id), cuyzValinorGenerator],
  [generatorKey(typescriptNativeGenerator.id), typescriptNativeGenerator]
])

function generatorKey(selection: GeneratorSelection): string {
  return `${selection.language}:${selection.package}`
}

export class GeneratorNotSupportedError extends Error {
  constructor(public readonly selection: GeneratorSelection) {
    super(`Unsupported generator target: ${selection.language}/${selection.package}`)
    this.name = 'GeneratorNotSupportedError'
  }
}

export function getGenerator(selection: GeneratorSelection): AnyGenerator {
  const generator = REGISTRY.get(generatorKey(selection))

  if (!generator) {
    throw new GeneratorNotSupportedError(selection)
  }

  return generator
}

export function getDefaultGeneratorSettings(selection: GeneratorSelection): unknown {
  return getGenerator(selection).getDefaultSettings()
}
