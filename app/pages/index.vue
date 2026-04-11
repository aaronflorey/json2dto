<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { createHighlighter } from 'shiki'

interface GeneratedFile {
  path: string
  contents: string
}

type PropertyCasing = 'camelCase' | 'PascalCase' | 'snake_case'

interface PhpGeneratorSettings {
  rootName: string
  namespace: string
  addDataSuffix: boolean
  finalClasses: boolean
  readonlyClasses: boolean
  addGetters: boolean
  addSetters: boolean
  allPropertiesNullable: boolean
  propertyCasing: PropertyCasing
}

interface TypeScriptGeneratorSettings {
  rootName: string
  allPropertiesNullable: boolean
  propertyCasing: PropertyCasing
}

interface GenerateResponse {
  artifact: {
    files: GeneratedFile[]
    metadata: {
      rootName: string
      isSingleFile: boolean
      generatedAt: string
    }
  }
}

const jsonInput = ref('')
const loading = ref(false)
const errorMessage = ref('')
const files = ref<GeneratedFile[]>([])
const selectedPath = ref<string>('')
const highlightedPreview = ref('')
const exportMessage = ref('')

const selectedLanguage = useStorage('json2dto.language', 'php')
const selectedPackage = useStorage('json2dto.package', 'spatie/laravel-data')
const packageOptions = {
  php: ['spatie/laravel-data', 'crell/serde', 'cuyz/valinor'],
  typescript: ['native']
} as const
const phpGeneratorSettings = useStorage<PhpGeneratorSettings>('json2dto.settings.php', {
  rootName: 'Root',
  namespace: 'App\\Data',
  addDataSuffix: true,
  finalClasses: true,
  readonlyClasses: false,
  addGetters: false,
  addSetters: false,
  allPropertiesNullable: false,
  propertyCasing: 'camelCase'
})
const typescriptGeneratorSettings = useStorage<TypeScriptGeneratorSettings>('json2dto.settings.typescript', {
  rootName: 'Root',
  allPropertiesNullable: false,
  propertyCasing: 'camelCase'
})

const selectedFile = computed(() => files.value.find((file) => file.path === selectedPath.value) ?? null)
const isPhpTarget = computed(() => selectedLanguage.value === 'php')
const activeGeneratorSettings = computed(() =>
  isPhpTarget.value ? phpGeneratorSettings.value : typescriptGeneratorSettings.value
)
const availablePackages = computed(() => packageOptions[selectedLanguage.value as keyof typeof packageOptions] ?? [])

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: ['php', 'typescript']
    })
  }

  return highlighterPromise
}

watch(
  selectedFile,
  async (file) => {
    if (!file) {
      highlightedPreview.value = ''
      return
    }

    const language = file.path.endsWith('.ts') ? 'typescript' : 'php'
    const highlighter = await getHighlighter()
    highlightedPreview.value = highlighter.codeToHtml(file.contents, {
      lang: language,
      theme: 'github-dark'
    })
  },
  { immediate: true }
)

watch(
  selectedLanguage,
  (language) => {
    const options = [...(packageOptions[language as keyof typeof packageOptions] ?? [])] as string[]

    if (!options.includes(selectedPackage.value)) {
      selectedPackage.value = options[0] ?? ''
    }
  },
  { immediate: true }
)

async function handleGenerate() {
  errorMessage.value = ''
  loading.value = true

  try {
    const response = await $fetch<GenerateResponse>('/api/generate', {
      method: 'POST',
      body: {
        json: jsonInput.value,
        target: {
          language: selectedLanguage.value,
          package: selectedPackage.value
        },
        settings: activeGeneratorSettings.value
      }
    })

    files.value = [...response.artifact.files].sort((a, b) => a.path.localeCompare(b.path))
    selectedPath.value = files.value[0]?.path ?? ''
  } catch (error) {
    const statusError = error as { data?: { message?: string }, statusMessage?: string }
    errorMessage.value = statusError?.statusMessage ?? statusError?.data?.message ?? 'Generation failed.'
  } finally {
    loading.value = false
  }
}

async function copySelectedFile() {
  if (!selectedFile.value) {
    return
  }

  await navigator.clipboard.writeText(selectedFile.value.contents)
  exportMessage.value = `Copied ${selectedFile.value.path}`
}

async function downloadSingleFile() {
  if (!selectedFile.value) {
    return
  }

  const response = await fetch('/api/export/file', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files: [selectedFile.value] })
  })

  if (!response.ok) {
    exportMessage.value = 'Failed to download selected file.'
    return
  }

  const blob = await response.blob()
  const filename = selectedFile.value.path.split('/').at(-1) ?? 'dto.txt'
  triggerBrowserDownload(blob, filename)
}

async function downloadAllFiles() {
  if (files.value.length === 0) {
    return
  }

  if (files.value.length === 1) {
    await downloadSingleFile()
    return
  }

  const response = await fetch('/api/export/zip', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files: files.value })
  })

  if (!response.ok) {
    exportMessage.value = 'Failed to download archive.'
    return
  }

  const blob = await response.blob()
  triggerBrowserDownload(blob, 'dto-files.zip')
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
  exportMessage.value = `Downloaded ${filename}`
}
</script>

<template>
  <main class="mx-auto max-w-7xl p-6 space-y-4">
    <header>
      <h1 class="text-2xl font-semibold">JSON → DTO Generator</h1>
      <p class="text-sm text-gray-600">Submit JSON to generate DTO files. Raw JSON is never persisted.</p>
    </header>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="space-y-3 rounded border p-4">
        <h2 class="font-medium">Input</h2>
        <textarea
          v-model="jsonInput"
          rows="16"
          class="w-full rounded border p-2 font-mono text-sm"
          placeholder='{"user":{"name":"Ada"}}'
        />

        <div class="grid gap-2 sm:grid-cols-2">
          <label class="text-sm">
            Language
            <select v-model="selectedLanguage" class="mt-1 w-full rounded border p-2">
              <option value="php">PHP</option>
              <option value="typescript">TypeScript</option>
            </select>
          </label>

          <label class="text-sm">
            DTO Package
            <select v-model="selectedPackage" class="mt-1 w-full rounded border p-2">
              <option v-for="pkg in availablePackages" :key="pkg" :value="pkg">{{ pkg }}</option>
            </select>
          </label>
        </div>

        <div class="grid gap-2 sm:grid-cols-2">
          <label class="text-sm">
            Root name
            <input v-model="activeGeneratorSettings.rootName" class="mt-1 w-full rounded border p-2" />
          </label>

          <label v-if="isPhpTarget" class="text-sm">
            Namespace
            <input v-model="phpGeneratorSettings.namespace" class="mt-1 w-full rounded border p-2" />
          </label>

          <label class="text-sm">
            Property casing
            <select v-model="activeGeneratorSettings.propertyCasing" class="mt-1 w-full rounded border p-2">
              <option value="camelCase">camelCase</option>
              <option value="PascalCase">PascalCase</option>
              <option value="snake_case">snake_case</option>
            </select>
          </label>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 text-sm">
          <label><input v-model="activeGeneratorSettings.allPropertiesNullable" type="checkbox" /> Nullable properties</label>
          <template v-if="isPhpTarget">
            <label><input v-model="phpGeneratorSettings.addDataSuffix" type="checkbox" /> Add Data suffix</label>
            <label><input v-model="phpGeneratorSettings.finalClasses" type="checkbox" /> Final classes</label>
            <label><input v-model="phpGeneratorSettings.readonlyClasses" type="checkbox" /> Readonly classes</label>
            <label><input v-model="phpGeneratorSettings.addGetters" type="checkbox" /> Add getters</label>
            <label><input v-model="phpGeneratorSettings.addSetters" type="checkbox" /> Add setters</label>
          </template>
        </div>

        <button
          class="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          :disabled="loading"
          @click="handleGenerate"
        >
          {{ loading ? 'Generating…' : 'Generate DTOs' }}
        </button>

        <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
      </section>

      <section class="rounded border p-4 space-y-3">
        <h2 class="font-medium">Preview</h2>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="file in files"
            :key="file.path"
            class="rounded border px-2 py-1 text-xs"
            :class="file.path === selectedPath ? 'bg-black text-white' : ''"
            @click="selectedPath = file.path"
          >
            {{ file.path }}
          </button>
        </div>

        <ClientOnly>
          <div v-if="selectedFile" class="overflow-auto rounded border bg-[#0d1117] p-3 text-sm" v-html="highlightedPreview" />
        </ClientOnly>

        <div class="flex flex-wrap gap-2" v-if="selectedFile">
          <button class="rounded border px-3 py-1 text-sm" @click="copySelectedFile">Copy selected</button>
          <button class="rounded border px-3 py-1 text-sm" @click="downloadSingleFile">Download selected</button>
          <button class="rounded border px-3 py-1 text-sm" @click="downloadAllFiles">
            {{ files.length > 1 ? 'Download all (.zip)' : 'Download file' }}
          </button>
        </div>

        <p v-if="exportMessage" class="text-xs text-gray-600">{{ exportMessage }}</p>

        <p v-if="!selectedFile" class="text-sm text-gray-600">Generate JSON to preview DTO files.</p>
      </section>
    </div>
  </main>
</template>
