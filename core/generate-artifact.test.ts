import { describe, expect, it } from 'vitest'
import { generateArtifactFromJson } from './generate-artifact'
import { GeneratorNotSupportedError } from './generators/registry'

describe('generateArtifactFromJson', () => {
  it('generates a flat Laravel Data DTO', () => {
    const result = generateArtifactFromJson({
      rawJson: JSON.stringify({ first_name: 'Ada', active: true })
    })

    expect(result.artifact.files).toHaveLength(1)
    expect(result.artifact.files[0]?.contents).toContain('extends Data')
    expect(result.artifact.files[0]?.contents).toContain('public string $firstName')
    expect(result.artifact.files[0]?.contents).toContain('public bool $active')
  })

  it('generates nested DTO files and honors namespace settings', () => {
    const result = generateArtifactFromJson({
      rawJson: JSON.stringify({ user: { address: { city: 'London' } } }),
      settings: {
        namespace: 'App\\Domain\\Dtos',
        rootName: 'Profile',
        addDataSuffix: true
      }
    })

    const paths = result.artifact.files.map((file) => file.path)

    expect(paths).toContain('app/Domain/Dtos/ProfileData.php')
    expect(paths).toContain('app/Domain/Dtos/Profile/UserData.php')
    expect(paths).toContain('app/Domain/Dtos/Profile/User/AddressData.php')
  })

  it('applies readonly and casing settings', () => {
    const result = generateArtifactFromJson({
      rawJson: JSON.stringify({ user_name: 'Ada' }),
      settings: {
        readonlyClasses: true,
        propertyCasing: 'snake_case'
      }
    })

    expect(result.artifact.files[0]?.contents).toContain('readonly class')
    expect(result.artifact.files[0]?.contents).toContain('$user_name')
  })

  it('generates Crell Serde output with field attributes for renamed properties', () => {
    const result = generateArtifactFromJson({
      rawJson: JSON.stringify({ first_name: 'Ada' }),
      target: { language: 'php', package: 'crell/serde' }
    })

    expect(result.artifact.files).toHaveLength(1)
    expect(result.artifact.files[0]?.contents).toContain('use Crell\\Serde\\Attributes\\Field;')
    expect(result.artifact.files[0]?.contents).toContain("#[Field(name: 'first_name')]")
    expect(result.artifact.files[0]?.contents).not.toContain('extends Data')
  })

  it('generates Valinor output with list docblocks for object arrays', () => {
    const result = generateArtifactFromJson({
      rawJson: JSON.stringify({ users: [{ name: 'Ada' }] }),
      target: { language: 'php', package: 'cuyz/valinor' }
    })

    const rootFile = result.artifact.files.find((file) => file.path.endsWith('/RootData.php'))

    expect(result.artifact.files).toHaveLength(2)
    expect(rootFile?.contents).toContain('@var list<UserData>')
    expect(rootFile?.contents).toContain('public array $users')
    expect(rootFile?.contents).not.toContain('extends Data')
  })

  it('generates TypeScript interfaces for the native target', () => {
    const result = generateArtifactFromJson({
      rawJson: JSON.stringify({ user_profile: { first_name: 'Ada' }, users: [{ active: true }] }),
      target: { language: 'typescript', package: 'native' },
      settings: {
        rootName: 'ApiPayload',
        propertyCasing: 'snake_case',
        allPropertiesNullable: true
      }
    })

    expect(result.artifact.files).toHaveLength(1)
    expect(result.artifact.files[0]?.path).toBe('src/dto/ApiPayload.ts')
    expect(result.artifact.files[0]?.contents).toContain('export interface ApiPayload')
    expect(result.artifact.files[0]?.contents).toContain('user_profile: UserProfile | null')
    expect(result.artifact.files[0]?.contents).toContain('users: Array<User> | null')
    expect(result.artifact.files[0]?.contents).toContain('export interface User')
    expect(result.artifact.files[0]?.contents).toContain('active: boolean | null')
  })

  it('rejects unsupported generator selection', () => {
    expect(() =>
      generateArtifactFromJson({
        rawJson: '{"x":1}',
        target: { language: 'go', package: 'dto-kit' }
      })
    ).toThrowError(GeneratorNotSupportedError)
  })
})
