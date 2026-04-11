import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildZipArchive, ExportPayloadError, validateExportFiles } from './export-payload'

describe('export payload validation', () => {
  it('rejects empty file lists', () => {
    expect(() => validateExportFiles([])).toThrowError(ExportPayloadError)
  })

  it('rejects unsafe file paths', () => {
    expect(() =>
      validateExportFiles([{ path: '../secret.php', contents: '<?php' }])
    ).toThrowError(ExportPayloadError)
  })
})

describe('zip archive generation', () => {
  it('preserves file paths and contents', () => {
    const zip = buildZipArchive([
      { path: 'app/Data/UserData.php', contents: '<?php class UserData {}' },
      { path: 'app/Data/User/AddressData.php', contents: '<?php class AddressData {}' }
    ])

    const unzipped = unzipSync(zip)
    const keys = Object.keys(unzipped).sort()

    expect(keys).toEqual(['app/Data/User/AddressData.php', 'app/Data/UserData.php'])
    expect(strFromU8(unzipped['app/Data/UserData.php']!)).toContain('UserData')
    expect(strFromU8(unzipped['app/Data/User/AddressData.php']!)).toContain('AddressData')
  })
})
