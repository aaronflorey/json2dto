import { describe, expect, it } from 'vitest'
import { JsonInputError, parseJsonInput } from './parse-json-input'

describe('parseJsonInput', () => {
  it('parses valid object input', () => {
    const result = parseJsonInput('{"user":{"name":"Ada"}}')

    expect(result.byteLength).toBeGreaterThan(0)
    expect(result.value).toEqual({ user: { name: 'Ada' } })
  })

  it('rejects invalid JSON with actionable message', () => {
    expect(() => parseJsonInput('{"user":')).toThrowError(JsonInputError)

    try {
      parseJsonInput('{"user":')
    } catch (error) {
      const typed = error as JsonInputError
      expect(typed.code).toBe('INVALID_JSON')
      expect(typed.message).toContain('not valid JSON')
    }
  })

  it('rejects top-level arrays', () => {
    expect(() => parseJsonInput('[]')).toThrowError(JsonInputError)
  })
})
