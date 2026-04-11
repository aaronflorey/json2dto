import type { InferenceResult, InferredObject } from '../contracts'

export interface SettingDefinition {
  key: string
  label: string
  type: 'boolean' | 'string' | 'enum'
  options?: string[]
  defaultValue: string | boolean
}

export interface GeneratorSelection {
  language: string
  package: string
}

export type PropertyCasing = 'camelCase' | 'PascalCase' | 'snake_case'

export interface BaseGeneratorSettings {
  rootName: string
  allPropertiesNullable: boolean
  propertyCasing: PropertyCasing
}

export interface LaravelGeneratorSettings extends BaseGeneratorSettings {
  namespace: string
  addDataSuffix: boolean
  finalClasses: boolean
  readonlyClasses: boolean
  addGetters: boolean
  addSetters: boolean
}

export interface TypeScriptGeneratorSettings extends BaseGeneratorSettings {}

export type GeneratorSettings = LaravelGeneratorSettings | TypeScriptGeneratorSettings

export interface GeneratorContext {
  inference: InferenceResult
  root: InferredObject
}

export interface Generator<TSettings> {
  id: GeneratorSelection
  getSettings(): SettingDefinition[]
  getDefaultSettings(): TSettings
  generate(context: GeneratorContext, settings: TSettings): import('../contracts').GeneratedOutput
}
