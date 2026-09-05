'use strict'

const { test } = require('node:test')
const build = require('..')

const marker = '__fastJsonStringifyCodeGenerationMarker'

test('schema references with line breaks do not alter generated code', (t) => {
  t.after(() => {
    delete globalThis[marker]
  })

  const objectPropertyName = `nested\n;globalThis.${marker} = true\n//`
  const arrayPropertyName = `list\n;globalThis.${marker} = true\n//`
  const input = {
    [objectPropertyName]: {
      value: 'safe'
    },
    [arrayPropertyName]: ['safe']
  }

  const stringify = build({
    type: 'object',
    properties: {
      [objectPropertyName]: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      },
      [arrayPropertyName]: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  })

  t.assert.equal(globalThis[marker], undefined)
  const output = stringify(input)
  t.assert.equal(globalThis[marker], undefined)
  t.assert.equal(output, JSON.stringify(input))
})

function testSchemaRefError (name, propertySchema, invalidValue) {
  test(`schema references are escaped in generated ${name} errors`, (t) => {
    t.after(() => {
      delete globalThis[marker]
    })

    const propertyName = `${name}\`,globalThis.${marker}=true,\``
    const stringify = build({
      type: 'object',
      properties: {
        [propertyName]: propertySchema
      }
    })

    t.assert.throws(
      () => stringify({ [propertyName]: invalidValue }),
      new TypeError(`The value of '#/properties/${propertyName}' does not match schema definition.`)
    )
    t.assert.equal(globalThis[marker], undefined)
  })
}

testSchemaRefError('array', {
  type: 'array',
  items: { type: 'string' }
}, 'not an array')

testSchemaRefError('multi-type', {
  type: ['string', 'number']
}, {})

testSchemaRefError('anyOf', {
  anyOf: [
    { type: 'string' },
    { type: 'number' }
  ]
}, false)

test('pattern property expressions are preserved in generated code', (t) => {
  const newlinePattern = '^line\nbreak$'
  const slashPattern = '^backslash\\\\/$'
  const stringify = build({
    type: 'object',
    patternProperties: {
      [newlinePattern]: { type: 'string' },
      [slashPattern]: { type: 'string' }
    }
  })

  const input = {
    'line\nbreak': 'newline',
    'backslash\\/': 'slash',
    'backslash/': 'does not match'
  }

  t.assert.equal(stringify(input), '{"line\\nbreak":"newline","backslash\\\\/":"slash"}')
})

test('quoted external schema ids are escaped in anyOf validator calls', (t) => {
  const stringSchemaId = 'external"string'
  const numberSchemaId = 'external"number'
  const stringify = build({
    anyOf: [
      { $ref: `${stringSchemaId}#` },
      { $ref: `${numberSchemaId}#` }
    ]
  }, {
    schema: {
      stringSchema: {
        $id: stringSchemaId,
        type: 'string'
      },
      numberSchema: {
        $id: numberSchemaId,
        type: 'number'
      }
    }
  })

  t.assert.equal(stringify('safe'), '"safe"')
  t.assert.equal(stringify(42), '42')
})

test('quoted external schema ids are escaped in if validator calls', (t) => {
  const schemaId = 'condition"schema'
  const thenSchema = {
    properties: {
      value: { type: 'string' }
    }
  }
  const options = {
    schema: {
      condition: {
        $id: schemaId,
        type: 'object',
        properties: {
          kind: { const: 'string' }
        },
        required: ['kind']
      }
    }
  }
  const stringify = build({
    type: 'object',
    if: { $ref: `${schemaId}#` },
    then: thenSchema,
    else: {
      properties: {
        value: { type: 'number' }
      }
    }
  }, options)
  const stringifyWithoutElse = build({
    type: 'object',
    if: { $ref: `${schemaId}#` },
    then: thenSchema
  }, options)

  t.assert.equal(stringify({ kind: 'string', value: 'safe' }), '{"value":"safe"}')
  t.assert.equal(stringify({ kind: 'number', value: 42 }), '{"value":42}')
  t.assert.equal(stringifyWithoutElse({ kind: 'string', value: 'safe' }), '{"value":"safe"}')
})
