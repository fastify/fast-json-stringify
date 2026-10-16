'use strict'

const { test } = require('node:test')
const build = require('..')
const Validator = require('../lib/validator')

for (const keyword of ['const', 'enum']) {
  for (const union of ['anyOf', 'oneOf']) {
    test(`${union} preserves schema-like objects in ${keyword}`, (t) => {
      const values = [
        { type: 'string' },
        { type: ['string', 'null'] },
        { nested: [{ type: 'string' }] }
      ]
      t.plan(values.length * 4)

      for (const value of values) {
        const schema = {
          [union]: [
            { [keyword]: keyword === 'enum' ? [value] : value },
            { type: 'null' }
          ]
        }
        const originalSchema = structuredClone(schema)
        const stringify = build(schema)

        t.assert.equal(stringify(value), JSON.stringify(value))
        t.assert.equal(stringify(null), 'null')
        t.assert.throws(() => stringify({ type: 'number' }), /does not match schema definition/)
        t.assert.deepStrictEqual(schema, originalSchema)
      }
    })
  }
}

test('validator preserves data in annotations and unknown keywords', (t) => {
  t.plan(1)
  const schema = {
    $id: 'annotations',
    default: { type: 'string' },
    examples: [{ type: ['string', 'null'] }],
    'x-example': { type: 'string' }
  }
  const validator = new Validator()
  validator.addSchema(schema)

  t.assert.deepStrictEqual(validator.ajv.getSchema('annotations').schema, schema)
})

for (const property of ['const', 'enum', 'default', 'examples']) {
  test(`validator still converts a property named ${property}`, (t) => {
    t.plan(1)
    const schema = {
      anyOf: [{
        type: 'object',
        properties: { [property]: { type: 'string' } },
        required: [property]
      }]
    }
    const value = { [property]: new Date('2026-01-01T00:00:00.000Z') }

    t.assert.equal(build(schema)(value), JSON.stringify(value))
  })
}

const subschema = { type: 'string' }
const convertedSubschema = { type: ['string', 'object'], fjs_type: 'string' }

for (const keyword of [
  'additionalItems', 'items', 'contains', 'additionalProperties',
  'propertyNames', 'not', 'if', 'then', 'else'
]) {
  test(`validator converts a subschema in ${keyword}`, (t) => {
    t.plan(2)
    const schema = { [keyword]: structuredClone(subschema) }
    const validator = new Validator()
    validator.convertSchemaToAjvFormat(schema)
    t.assert.deepStrictEqual(schema, { [keyword]: convertedSubschema })

    const booleanSchema = { [keyword]: true }
    validator.convertSchemaToAjvFormat(booleanSchema)
    t.assert.deepStrictEqual(booleanSchema, { [keyword]: true })
  })
}

for (const keyword of ['items', 'allOf', 'anyOf', 'oneOf']) {
  test(`validator converts an array of subschemas in ${keyword}`, (t) => {
    t.plan(1)
    const schema = { [keyword]: [structuredClone(subschema), false] }
    new Validator().convertSchemaToAjvFormat(schema)
    t.assert.deepStrictEqual(schema, { [keyword]: [convertedSubschema, false] })
  })
}

for (const keyword of ['$defs', 'definitions', 'properties', 'patternProperties', 'dependencies']) {
  test(`validator converts a map of subschemas in ${keyword}`, (t) => {
    t.plan(1)
    const schema = { [keyword]: { const: structuredClone(subschema), enum: false } }
    new Validator().convertSchemaToAjvFormat(schema)
    t.assert.deepStrictEqual(schema, { [keyword]: { const: convertedSubschema, enum: false } })
  })
}

test('validator preserves property dependencies', (t) => {
  t.plan(1)
  const schema = { dependencies: { type: ['string', 'other'] } }
  new Validator().convertSchemaToAjvFormat(schema)
  t.assert.deepStrictEqual(schema, { dependencies: { type: ['string', 'other'] } })
})

for (const union of ['anyOf', 'oneOf']) {
  test(`${union} preserves dependencies for a property named type`, (t) => {
    t.plan(2)
    const schema = {
      [union]: [{
        type: 'object',
        properties: {
          type: { type: 'string' },
          string: { type: 'number' },
          other: { type: 'number' }
        },
        dependencies: { type: ['string', 'other'] }
      }]
    }
    const stringify = build(schema)
    const value = { type: 'value', string: 1, other: 2 }

    t.assert.equal(stringify(value), JSON.stringify(value))
    t.assert.throws(() => stringify({ type: 'value', string: 1 }), /does not match schema definition/)
  })
}
