import { describe, expect, it } from 'vitest'
import { inferJsonTypes } from './infer-types'

describe('inferJsonTypes', () => {
  it('preserves source key order', () => {
    const result = inferJsonTypes({ b: 'text', a: true }, 'RootData')
    expect(result.root.properties.map((property) => property.key)).toEqual(['b', 'a'])
  })

  it('deduplicates identical object shapes', () => {
    const result = inferJsonTypes({
      billing: { line1: 'A', zip: '1' },
      shipping: { line1: 'B', zip: '2' }
    })

    const nestedObjects = result.shapes.filter((shape) => shape.nameHint !== 'RootData')
    expect(nestedObjects).toHaveLength(1)
  })

  it('infers datetime, number_string, and boolean values', () => {
    const result = inferJsonTypes({
      createdAt: '2026-04-11T10:00:00Z',
      price: 42,
      active: false
    })

    const properties = Object.fromEntries(
      result.root.properties.map((property) => [property.key, property.value])
    )

    expect(properties.createdAt).toMatchObject({ kind: 'primitive', type: 'datetime' })
    expect(properties.price).toMatchObject({ kind: 'primitive', type: 'number_string' })
    expect(properties.active).toMatchObject({ kind: 'primitive', type: 'boolean' })
  })
})
