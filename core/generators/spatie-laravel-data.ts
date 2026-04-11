import type { GeneratedFile, GeneratedOutput, InferredArray, InferredObject, InferredValue } from '../contracts'
import type { Generator, GeneratorContext, LaravelGeneratorSettings, SettingDefinition } from './types'

interface ClassRecord {
  className: string
  namespace: string
  object: InferredObject
}

const SETTINGS: SettingDefinition[] = [
  { key: 'rootName', label: 'Root class name', type: 'string', defaultValue: 'RootData' },
  { key: 'namespace', label: 'Root namespace', type: 'string', defaultValue: 'App\\Data' },
  { key: 'addDataSuffix', label: 'Add Data suffix', type: 'boolean', defaultValue: true },
  { key: 'finalClasses', label: 'Final classes', type: 'boolean', defaultValue: true },
  { key: 'readonlyClasses', label: 'Readonly classes', type: 'boolean', defaultValue: false },
  { key: 'addGetters', label: 'Add getters', type: 'boolean', defaultValue: false },
  { key: 'addSetters', label: 'Add setters', type: 'boolean', defaultValue: false },
  { key: 'allPropertiesNullable', label: 'All properties nullable', type: 'boolean', defaultValue: false },
  {
    key: 'propertyCasing',
    label: 'Property casing',
    type: 'enum',
    options: ['camelCase', 'PascalCase', 'snake_case'],
    defaultValue: 'camelCase'
  }
]

export const laravelDataGenerator: Generator<LaravelGeneratorSettings> = {
  id: {
    language: 'php',
    package: 'spatie/laravel-data'
  },

  getSettings() {
    return SETTINGS
  },

  getDefaultSettings() {
    return {
      rootName: 'Root',
      namespace: 'App\\Data',
      addDataSuffix: true,
      finalClasses: true,
      readonlyClasses: false,
      addGetters: false,
      addSetters: false,
      allPropertiesNullable: false,
      propertyCasing: 'camelCase'
    }
  },

  generate(context: GeneratorContext, settings: LaravelGeneratorSettings): GeneratedOutput {
    const normalizedSettings = normalizeSettings(settings)
    const classBySignature = new Map<string, ClassRecord>()
    const records: ClassRecord[] = []

    const rootClassName = ensureSuffix(toPascalCase(normalizedSettings.rootName), normalizedSettings.addDataSuffix)
    const nestedNamespaceRoot = `${normalizedSettings.namespace}\\${stripDataSuffix(rootClassName)}`

    ensureRecord(context.root, rootClassName, normalizedSettings.namespace, classBySignature, records)
    walkObjects(context.root, nestedNamespaceRoot, normalizedSettings, classBySignature, records)

    const files = records
      .map((record) => renderRecord(record, classBySignature, normalizedSettings))
      .sort((a, b) => a.path.localeCompare(b.path))

    return {
      files,
      metadata: {
        rootName: rootClassName,
        isSingleFile: files.length === 1,
        generatedAt: new Date().toISOString()
      }
    }
  }
}

function normalizeSettings(input: LaravelGeneratorSettings): LaravelGeneratorSettings {
  return {
    ...input,
    rootName: input.rootName || 'Root',
    namespace: input.namespace || 'App\\Data'
  }
}

function walkObjects(
  object: InferredObject,
  nestedNamespace: string,
  settings: LaravelGeneratorSettings,
  classBySignature: Map<string, ClassRecord>,
  records: ClassRecord[]
): void {
  for (const property of object.properties) {
    if (property.value.kind === 'object') {
      const className = ensureSuffix(toPascalCase(property.key), settings.addDataSuffix)
      const record = ensureRecord(property.value, className, nestedNamespace, classBySignature, records)
      walkObjects(record.object, `${nestedNamespace}\\${stripDataSuffix(record.className)}`, settings, classBySignature, records)
      continue
    }

    if (property.value.kind === 'array') {
      const nestedObject = arrayObject(property.value)

      if (nestedObject) {
        const className = ensureSuffix(toPascalCase(singularize(property.key)), settings.addDataSuffix)
        const record = ensureRecord(nestedObject, className, nestedNamespace, classBySignature, records)
        walkObjects(record.object, `${nestedNamespace}\\${stripDataSuffix(record.className)}`, settings, classBySignature, records)
      }
    }
  }
}

function ensureRecord(
  object: InferredObject,
  className: string,
  namespace: string,
  classBySignature: Map<string, ClassRecord>,
  records: ClassRecord[]
): ClassRecord {
  const existing = classBySignature.get(object.signature)

  if (existing) {
    return existing
  }

  const created: ClassRecord = {
    className,
    namespace,
    object
  }

  classBySignature.set(object.signature, created)
  records.push(created)
  return created
}

function renderRecord(
  record: ClassRecord,
  classBySignature: Map<string, ClassRecord>,
  settings: LaravelGeneratorSettings
): GeneratedFile {
  const imports = new Set<string>(['Spatie\\LaravelData\\Data'])
  const properties = record.object.properties.map((property) => {
    const propertyName = applyCasing(property.key, settings.propertyCasing)
    const phpType = resolveType(property.value, record.namespace, classBySignature, imports)
    const nullable = settings.allPropertiesNullable ? '?' : ''
    const setterType = settings.allPropertiesNullable ? `?${phpType.typeHint}` : phpType.typeHint

    return {
      originalName: property.key,
      propertyName,
      typeHint: `${nullable}${phpType.typeHint}`,
      setterType,
      docblock: phpType.docblock
    }
  })

  const classModifiers = [settings.finalClasses ? 'final' : null, settings.readonlyClasses ? 'readonly' : null, 'class']
    .filter(Boolean)
    .join(' ')

  const useLines = Array.from(imports)
    .sort()
    .map((useItem) => `use ${useItem};`)
    .join('\n')

  const constructorParams = properties
    .map((property) => {
      const doc = property.docblock ? `        /** ${property.docblock} */\n` : ''
      return `${doc}        public ${property.typeHint} $${property.propertyName}`
    })
    .join(',\n')

  const getterMethods = settings.addGetters
    ? `\n${properties
        .map(
          (property) =>
            `    public function get${toPascalCase(property.propertyName)}(): ${property.typeHint}\n    {\n        return $this->${property.propertyName};\n    }`
        )
        .join('\n\n')}\n`
    : ''

  const setterMethods = settings.addSetters && !settings.readonlyClasses
    ? `\n${properties
        .map(
          (property) =>
            `    public function set${toPascalCase(property.propertyName)}(${property.setterType} $value): self\n    {\n        $this->${property.propertyName} = $value;\n\n        return $this;\n    }`
        )
        .join('\n\n')}\n`
    : ''

  const contents = `<?php

declare(strict_types=1);

namespace ${record.namespace};

${useLines}

${classModifiers} ${record.className} extends Data
{
    public function __construct(
${constructorParams}
    ) {
    }${getterMethods}${setterMethods}}
`

  return {
    path: `${namespaceToPath(record.namespace)}/${record.className}.php`,
    contents
  }
}

function resolveType(
  value: InferredValue,
  currentNamespace: string,
  classBySignature: Map<string, ClassRecord>,
  imports: Set<string>
): { typeHint: string, docblock?: string } {
  if (value.kind === 'primitive') {
    if (value.type === 'boolean') return { typeHint: 'bool' }
    if (value.type === 'datetime') {
      imports.add('DateTimeImmutable')
      return { typeHint: 'DateTimeImmutable' }
    }

    if (value.type === 'null' || value.type === 'unknown') return { typeHint: 'mixed' }

    return { typeHint: 'string' }
  }

  if (value.kind === 'object') {
    const record = classBySignature.get(value.signature)

    if (!record) {
      return { typeHint: 'mixed' }
    }

    if (record.namespace !== currentNamespace) {
      imports.add(`${record.namespace}\\${record.className}`)
    }

    return { typeHint: record.className }
  }

  const nestedObject = arrayObject(value)

  if (!nestedObject) {
    return { typeHint: 'array' }
  }

  imports.add('Illuminate\\Support\\Collection')
  const record = classBySignature.get(nestedObject.signature)

  if (!record) {
    return { typeHint: 'Collection' }
  }

  if (record.namespace !== currentNamespace) {
    imports.add(`${record.namespace}\\${record.className}`)
  }

  return {
    typeHint: 'Collection',
    docblock: `@var Collection<int, ${record.className}>`
  }
}

function arrayObject(array: InferredArray): InferredObject | null {
  return array.items.kind === 'object' ? array.items : null
}

function namespaceToPath(namespace: string): string {
  const segments = namespace.split('\\').filter(Boolean)
  const root = segments[0] === 'App' ? 'app' : 'src'
  return [root, ...segments.slice(1)].join('/')
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
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  const parts = cleaned.length ? cleaned.split(/\s+/) : ['Item']
  const parsed = parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('')
  return /^\d/.test(parsed) ? `_${parsed}` : parsed || 'Item'
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value)
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`
}

function toSnakeCase(value: string): string {
  return toPascalCase(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
}

function applyCasing(value: string, casing: LaravelGeneratorSettings['propertyCasing']): string {
  if (casing === 'PascalCase') {
    return toPascalCase(value)
  }

  if (casing === 'snake_case') {
    return toSnakeCase(value)
  }

  return toCamelCase(value)
}

function ensureSuffix(value: string, enabled: boolean): string {
  if (!enabled) {
    return value
  }

  return value.endsWith('Data') ? value : `${value}Data`
}

function stripDataSuffix(value: string): string {
  return value.endsWith('Data') ? value.slice(0, -4) : value
}
