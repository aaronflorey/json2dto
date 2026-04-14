import type { GeneratedFile, GeneratedOutput } from '../contracts'
import type { Generator, GeneratorContext, TypeScriptGeneratorSettings } from './types'
import {
  collectInterfaceRecords,
  createTypeScriptNameMap,
  getTypeScriptPropertyName,
  resolveTypeScriptType
} from './typescript-shared'
import { toPascalCase } from './php-shared'

const defaultSettings: TypeScriptGeneratorSettings = {
  rootName: 'Root',
  allPropertiesNullable: false,
  propertyCasing: 'camelCase'
}

export const javascriptJSDocGenerator: Generator<TypeScriptGeneratorSettings> = {
  id: {
    language: 'javascript',
    package: 'jsdoc'
  },

  getSettings() {
    return []
  },

  getDefaultSettings() {
    return defaultSettings
  },

  generate(context: GeneratorContext, settings: TypeScriptGeneratorSettings): GeneratedOutput {
    const normalizedRootName = toPascalCase(settings.rootName || 'Root')
    const records = collectInterfaceRecords(context.root, normalizedRootName)
    const nameBySignature = createTypeScriptNameMap(records)
    const declarations = records
      .map((record) => renderTypedef(record, nameBySignature, settings))
      .join('\n\n')

    const file: GeneratedFile = {
      path: `src/dto/${normalizedRootName}.js`,
      contents: `// @ts-check\n\n${declarations}\n`
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

function renderTypedef(
  record: { name: string, object: GeneratorContext['root'] },
  nameBySignature: Map<string, string>,
  settings: TypeScriptGeneratorSettings
): string {
  const lines = record.object.properties.map((property) => {
    const propertyName = getTypeScriptPropertyName(property.key, settings)
    const optional = property.optional ? '?' : ''
    const type = resolveTypeScriptType(property.value, nameBySignature, settings.allPropertiesNullable)

    return ` *   ${propertyName}${optional}: ${type};`
  })

  return ['/**', ' * @typedef {{', ...lines, ` * }} ${record.name}`, ' */'].join('\n')
}
