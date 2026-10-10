'use strict'

const { test } = require('node:test')
const Module = require('node:module')
const build = require('..')

function restoreStandalone (code) {
  const standaloneModule = new Module(`${__filename}.standalone.cjs`, module)
  standaloneModule.filename = `${__filename}.standalone.cjs`
  standaloneModule.paths = module.paths
  standaloneModule._compile(code, standaloneModule.filename)
  return standaloneModule.exports
}

const marker = '__fastJsonStringifyCodeGenerationMarker'

test('schema references with line breaks do not alter generated code', (t) => {
  t.after(() => {
    delete globalThis[marker]
  })

  const objectPropertyName = `nested\n;globalThis.${marker} = true\n//`
  const arrayPropertyName = `list\n;globalThis.${marker} = true\n//`
  const surrogatePropertyName = 'surrogate\uD800key'
  const input = {
    [objectPropertyName]: {
      value: 'safe'
    },
    [arrayPropertyName]: ['safe'],
    [surrogatePropertyName]: 'safe'
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
      },
      [surrogatePropertyName]: { type: 'string' }
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

    const escapedPropertyName = encodeURIComponent(
      propertyName.replace(/~/g, '~0').replace(/\//g, '~1')
    )
    t.assert.throws(
      () => stringify({ [propertyName]: invalidValue }),
      new TypeError(`The value of '#/properties/${escapedPropertyName}' does not match schema definition.`)
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

test('required property errors encode the complete message', (t) => {
  t.after(() => {
    delete globalThis[marker]
  })

  const propertyName = `required'\\\n\u2028\`,globalThis.${marker}=true,\``
  const schemas = [
    {
      type: 'object',
      required: [propertyName]
    },
    {
      type: 'object',
      properties: {
        [propertyName]: { type: 'string' }
      },
      required: [propertyName]
    }
  ]

  for (const schema of schemas) {
    const stringifiers = [
      build(schema),
      build.restore(build(schema, { mode: 'debug' })),
      restoreStandalone(build(schema, { mode: 'standalone' }))
    ]
    for (const stringify of stringifiers) {
      t.assert.throws(
        () => stringify({}),
        new Error(`"${propertyName}" is required!`)
      )
      t.assert.equal(globalThis[marker], undefined)
    }
  }
})

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

test('schema property names are escaped in validator JSON pointers', (t) => {
  const propertyNames = [
    'slash/key',
    'tilde~key',
    'percent%2Fkey',
    'separator\u2028key'
  ]
  const properties = Object.fromEntries(propertyNames.map(propertyName => [
    propertyName,
    {
      anyOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    }
  ]))
  const input = Object.fromEntries(propertyNames.map(propertyName => [propertyName, 'safe']))
  const schema = { type: 'object', properties }

  const stringify = build(schema)
  const restored = build.restore(build(schema, { mode: 'debug' }))
  const standalone = restoreStandalone(build(schema, { mode: 'standalone' }))
  const inlineStandalone = restoreStandalone(build(schema, {
    mode: 'standalone',
    inlineValidators: true
  }))

  t.assert.equal(stringify(input), JSON.stringify(input))
  t.assert.equal(restored(input), JSON.stringify(input))
  t.assert.equal(standalone(input), JSON.stringify(input))
  t.assert.equal(inlineStandalone(input), JSON.stringify(input))
})

test('unsafe schema ids are rejected when Ajv source generation is enabled', (t) => {
  const unsafeId = 'schema*/globalThis.codeGenerationMarker=true;/*'
  const schema = {
    anyOf: [
      { $ref: `${unsafeId}#` },
      { type: 'number' }
    ]
  }
  const externalSchemas = {
    external: { $id: unsafeId, type: 'object' }
  }
  const expectedError = {
    message: 'Schema $id must not contain "*/" when Ajv source code generation is enabled'
  }

  t.assert.doesNotThrow(() => build(schema, { schema: externalSchemas }))
  t.assert.doesNotThrow(() => build(
    { $id: unsafeId, type: 'string' },
    { ajv: { code: { source: true } } }
  ))
  for (const options of [
    { ajv: { code: { source: true } } },
    { mode: 'debug', ajv: { code: { source: true } } },
    { ajv: { code: { process () {} } } },
    { mode: 'standalone', inlineValidators: true }
  ]) {
    t.assert.throws(
      () => build(schema, { ...options, schema: externalSchemas }),
      expectedError
    )
  }

  const customIdSchema = {
    anyOf: [
      { xid: unsafeId, type: 'object' },
      { type: 'number' }
    ]
  }
  const customIdOptions = {
    ajv: {
      schemaId: 'xid',
      code: { source: true }
    }
  }
  for (const options of [
    customIdOptions,
    { ...customIdOptions, mode: 'debug' },
    {
      mode: 'standalone',
      inlineValidators: true,
      ajv: { schemaId: 'xid' }
    }
  ]) {
    t.assert.throws(
      () => build(customIdSchema, options),
      { message: 'Schema xid must not contain "*/" when Ajv source code generation is enabled' }
    )
  }
  const sharedSchema = { type: 'string' }
  t.assert.doesNotThrow(() => build({
    definitions: {
      container: {
        items: [sharedSchema],
        dependencies: {
          schemaDependency: sharedSchema,
          propertyDependency: ['value']
        },
        const: {
          $id: unsafeId,
          xid: unsafeId
        },
        default: { xid: unsafeId },
        enum: [{ xid: unsafeId }]
      }
    },
    anyOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  }, customIdOptions))
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
