import type { GeneratedFile, GeneratedOutput, InferredObject, InferredPrimitiveKind, InferredValue } from '../contracts'
import type { Generator, GeneratorContext, TypeScriptGeneratorSettings } from './types'
import { applyCasing, toPascalCase } from './php-shared'

interface InterfaceRecord {
  name: string
  object: InferredObject
}

const defaultSettings: TypeScriptGeneratorSettings = {
  rootName: 'Root',
  allPropertiesNullable: false,
  propertyCasing: 'camelCase'
}

export const typescriptNativeGenerator: Generator<TypeScriptGeneratorSettings> = {
  id: {
    language: 'typescript',
    package: 'native'
  },

  getSettings() {
    return []
  },

  getDefaultSettings() {
    return defaultSettings
  },

  generate(context: GeneratorContext, settings: TypeScriptGeneratorSettings): GeneratedOutput {
    const normalizedRootName = toPascalCase(settings.rootName || 'Root')
    const records = collectRecords(context.root, normalizedRootName)
    const nameBySignature = new Map(records.map((record) => [record.object.signature, record.name]))

    const declarations = records
      .map((record) => renderInterface(record, nameBySignature, settings))
      .join('\n\n')

    const file: GeneratedFile = {
      path: `src/dto/${normalizedRootName}.ts`,
      contents: `${declarations}\n`
    }

    return {
      files: [file],
      metadata: {
        rootName: normalizedRootName,
        isSingleFile: true,
        generatedAt: new Date().toISOString()
      }
    }
  }
}

function collectRecords(root: InferredObject, rootName: string): InterfaceRecord[] {
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

function renderInterface(
  record: InterfaceRecord,
  nameBySignature: Map<string, string>,
  settings: TypeScriptGeneratorSettings
): string {
  const lines = record.object.properties.map((property) => {
    const propertyName = applyCasing(property.key, settings.propertyCasing)
    const optional = property.optional ? '?' : ''
    const type = resolveTsType(property.value, nameBySignature, settings.allPropertiesNullable)
    return `  ${formatPropertyName(propertyName)}${optional}: ${type}`
  })

  return `export interface ${record.name} {\n${lines.join('\n')}\n}`
}

function resolveTsType(value: InferredValue, nameBySignature: Map<string, string>, nullable: boolean): string {
  let baseType: string

  if (value.kind === 'primitive') {
    baseType = mapPrimitive(value.type)
  } else if (value.kind === 'object') {
    baseType = nameBySignature.get(value.signature) ?? 'unknown'
  } else {
    const itemType = resolveTsType(value.items, nameBySignature, false)
    baseType = `Array<${itemType}>`
  }

  if (!nullable) {
    return baseType
  }

  return baseType.includes('null') ? baseType : `${baseType} | null`
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

function formatPropertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : `'${value}'`
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
