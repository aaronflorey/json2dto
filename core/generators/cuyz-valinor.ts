import type { GeneratedFile, GeneratedOutput } from '../contracts'
import type { Generator, GeneratorContext, LaravelGeneratorSettings } from './types'
import {
  type ClassRecord,
  PHP_SETTING_DEFINITIONS,
  applyCasing,
  buildPhpClassModel,
  getDefaultPhpSettings,
  namespaceToPath,
  resolvePhpType,
  toPascalCase
} from './php-shared'

export const cuyzValinorGenerator: Generator<LaravelGeneratorSettings> = {
  id: {
    language: 'php',
    package: 'cuyz/valinor'
  },

  getSettings() {
    return PHP_SETTING_DEFINITIONS
  },

  getDefaultSettings() {
    return getDefaultPhpSettings()
  },

  generate(context: GeneratorContext, settings: LaravelGeneratorSettings): GeneratedOutput {
    const model = buildPhpClassModel(context.root, settings)

    const files = model.records
      .map((record) => renderRecord(record, model.classBySignature, settings))
      .sort((a, b) => a.path.localeCompare(b.path))

    return {
      files,
      metadata: {
        rootName: model.rootClassName,
        isSingleFile: files.length === 1,
        generatedAt: new Date().toISOString()
      }
    }
  }
}

function renderRecord(
  record: ClassRecord,
  classBySignature: Map<string, ClassRecord>,
  settings: LaravelGeneratorSettings
): GeneratedFile {
  const imports = new Set<string>()
  const properties = record.object.properties.map((property) => {
    const propertyName = applyCasing(property.key, settings.propertyCasing)
    const phpType = resolvePhpType(property.value, record.namespace, classBySignature, imports, 'list')
    const nullable = settings.allPropertiesNullable ? '?' : ''
    const setterType = settings.allPropertiesNullable ? `?${phpType.typeHint}` : phpType.typeHint

    return {
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

  const importBlock = useLines ? `${useLines}\n\n` : ''

  const contents = `<?php

declare(strict_types=1);

namespace ${record.namespace};

${importBlock}${classModifiers} ${record.className}
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
