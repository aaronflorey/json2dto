import type {
  InferenceResult,
  InferredArray,
  InferredObject,
  InferredObjectProperty,
  InferredPrimitive,
  InferredPrimitiveKind,
  InferredValue
} from '../contracts'

interface InferenceContext {
  dedupe: Map<string, InferredObject>
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:[tT ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:[zZ]|[+-]\d{2}:?\d{2})?)?$/

export function inferJsonTypes(input: unknown, rootName = 'RootData'): InferenceResult {
  const ctx: InferenceContext = {
    dedupe: new Map<string, InferredObject>()
  }

  const root = inferObject(input as Record<string, unknown>, rootName, ctx)

  return {
    root,
    shapes: Array.from(ctx.dedupe.values())
  }
}

function inferValue(value: unknown, keyHint: string, ctx: InferenceContext): InferredValue {
  if (value === null) {
    return primitive('null')
  }

  if (Array.isArray(value)) {
    return inferArray(value, keyHint, ctx)
  }

  if (typeof value === 'object') {
    return inferObject(value as Record<string, unknown>, toPascalCase(keyHint), ctx)
  }

  if (typeof value === 'string') {
    return primitive(ISO_DATE_REGEX.test(value) ? 'datetime' : 'string')
  }

  if (typeof value === 'number') {
    return primitive('number_string')
  }

  if (typeof value === 'boolean') {
    return primitive('boolean')
  }

  return primitive('unknown')
}

function inferArray(values: unknown[], keyHint: string, ctx: InferenceContext): InferredArray {
  if (values.length === 0) {
    return {
      kind: 'array',
      items: primitive('unknown')
    }
  }

  const inferredItems = values.map((value) => inferValue(value, singularize(keyHint), ctx))
  const firstSignature = valueSignature(inferredItems[0])
  const allSame = inferredItems.every((item) => valueSignature(item) === firstSignature)

  return {
    kind: 'array',
    items: allSame ? inferredItems[0] : primitive('unknown')
  }
}

function inferObject(value: Record<string, unknown>, nameHint: string, ctx: InferenceContext): InferredObject {
  const entries = Object.entries(value)
  const properties: InferredObjectProperty[] = entries.map(([key, child]) => ({
    key,
    value: inferValue(child, key, ctx),
    optional: false
  }))

  const signature = objectSignature(properties)
  const existing = ctx.dedupe.get(signature)

  if (existing) {
    return existing
  }

  const inferredObject: InferredObject = {
    kind: 'object',
    nameHint,
    signature,
    properties
  }

  ctx.dedupe.set(signature, inferredObject)
  return inferredObject
}

function objectSignature(properties: InferredObjectProperty[]): string {
  return properties
    .map((property) => `${property.key}:${valueSignature(property.value)}`)
    .join('|')
}

function valueSignature(value: InferredValue): string {
  if (value.kind === 'primitive') {
    return value.type
  }

  if (value.kind === 'array') {
    return `array<${valueSignature(value.items)}>`
  }

  return `object{${value.signature}}`
}

function primitive(type: InferredPrimitiveKind): InferredPrimitive {
  return {
    kind: 'primitive',
    type
  }
}

function singularize(value: string): string {
  if (value.endsWith('ies')) {
    return `${value.slice(0, -3)}y`
  }

  if (value.endsWith('s') && value.length > 1) {
    return value.slice(0, -1)
  }

  return value
}

function toPascalCase(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  const words = sanitized.length ? sanitized.split(/\s+/) : ['Item']

  const pascal = words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join('')

  if (/^\d/.test(pascal)) {
    return `_${pascal}`
  }

  return pascal || 'Item'
}
