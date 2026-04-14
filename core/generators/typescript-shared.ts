import type { InferredObject, InferredPrimitiveKind, InferredValue } from '../contracts'
import type { TypeScriptGeneratorSettings } from './types'
import { applyCasing, toPascalCase } from './php-shared'

export interface InterfaceRecord {
  name: string
  object: InferredObject
}

export function collectInterfaceRecords(root: InferredObject, rootName: string): InterfaceRecord[] {
  const records: InterfaceRecord[] = []
  const nameBySignature = new Map<string, string>()
  const usedNames = new Set<string>()

  function assignName(signature: string, preferredName: string): string {
    const existing = nameBySignature.get(signature)

    if (existing) {
      return existing
    }

    const baseName = toPascalCase(preferredName)
    let candidate = baseName
    let index = 2

    while (usedNames.has(candidate)) {
      candidate = `${baseName}${index}`
      index += 1
    }

    nameBySignature.set(signature, candidate)
    usedNames.add(candidate)
    return candidate
  }

  function visit(object: InferredObject, preferredName: string): void {
    if (nameBySignature.has(object.signature)) {
      return
    }

    const name = assignName(object.signature, preferredName)
    records.push({ name, object })

    for (const property of object.properties) {
      if (property.value.kind === 'object') {
        visit(property.value, property.key)
        continue
      }

      if (property.value.kind === 'array' && property.value.items.kind === 'object') {
        visit(property.value.items, singularize(property.key))
      }
    }
  }

  visit(root, rootName)
  return records
}

export function createTypeScriptNameMap(records: InterfaceRecord[]): Map<string, string> {
  return new Map(records.map((record) => [record.object.signature, record.name]))
}

export function resolveTypeScriptType(
  value: InferredValue,
  nameBySignature: Map<string, string>,
  nullable: boolean
): string {
  let baseType: string

  if (value.kind === 'primitive') {
    baseType = mapPrimitive(value.type)
  } else if (value.kind === 'object') {
    baseType = nameBySignature.get(value.signature) ?? 'unknown'
  } else {
    const itemType = resolveTypeScriptType(value.items, nameBySignature, false)
    baseType = `Array<${itemType}>`
  }

  if (!nullable) {
    return baseType
  }

  return baseType.includes('null') ? baseType : `${baseType} | null`
}

export function formatTypeScriptPropertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : `'${value}'`
}

export function getTypeScriptPropertyName(key: string, settings: TypeScriptGeneratorSettings): string {
  return formatTypeScriptPropertyName(applyCasing(key, settings.propertyCasing))
}

function mapPrimitive(type: InferredPrimitiveKind): string {
  if (type === 'boolean') {
    return 'boolean'
  }

  if (type === 'null' || type === 'unknown') {
    return 'unknown'
  }

  return 'string'
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
