export interface GeneratedFile {
  path: string
  contents: string
}

export interface GenerationMetadata {
  rootName: string
  isSingleFile: boolean
  generatedAt: string
}

export interface GeneratedOutput {
  files: GeneratedFile[]
  metadata: GenerationMetadata
}

export type InferredPrimitiveKind = 'string' | 'datetime' | 'number_string' | 'boolean' | 'null' | 'unknown'

export interface InferredPrimitive {
  kind: 'primitive'
  type: InferredPrimitiveKind
}

export interface InferredObjectProperty {
  key: string
  value: InferredValue
  optional: boolean
}

export interface InferredObject {
  kind: 'object'
  nameHint: string
  signature: string
  properties: InferredObjectProperty[]
}

export interface InferredArray {
  kind: 'array'
  items: InferredValue
}

export type InferredValue = InferredPrimitive | InferredObject | InferredArray

export interface InferenceResult {
  root: InferredObject
  shapes: InferredObject[]
}
