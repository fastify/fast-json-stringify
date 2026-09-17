'use strict'

const { test } = require('node:test')
const build = require('..')

function createNestedSchema (depth) {
  let schema = { type: 'string' }

  for (let i = 0; i < depth; i++) {
    schema = {
      type: 'object',
      properties: { value: schema }
    }
  }

  return schema
}

function createNestedNotSchema (depth) {
  let schema = { type: 'string' }
  for (let i = 0; i < depth; i++) schema = { not: schema }
  return { anyOf: [schema] }
}

function createReferencedNotSchema (depth) {
  const definitions = {}
  for (let i = 0; i < depth; i++) {
    definitions[`schema-${i}`] = {
      not: i + 1 < depth
        ? { $ref: `#/definitions/schema-${i + 1}` }
        : { type: 'string' }
    }
  }
  return {
    definitions,
    anyOf: [{ $ref: '#/definitions/schema-0' }]
  }
}

test('rejects schemas deeper than the default maximum without exhausting the stack', (t) => {
  t.assert.throws(
    () => build(createNestedSchema(101)),
    (error) => {
      t.assert.equal(error.constructor, Error)
      t.assert.equal(error.message, 'schema exceeds maximum depth of 100')
      return true
    }
  )
  t.assert.doesNotThrow(() => build(createNestedSchema(100)))
})

test('accepted boundary is safe for eager and lazy Ajv compilation', (t) => {
  for (const createSchema of [createNestedNotSchema, createReferencedNotSchema]) {
    for (const compileValidators of [false, true]) {
      const stringify = build(createSchema(99), { compileValidators })
      t.assert.doesNotThrow(() => stringify(42))
    }
  }

  t.assert.throws(
    () => build(createReferencedNotSchema(100)),
    { message: 'schema exceeds maximum depth of 100' }
  )
})

test('rejects deeply nested non-schema values before dependency traversal', (t) => {
  let defaultValue = 'value'
  for (let i = 0; i < 2000; i++) defaultValue = { value: defaultValue }

  t.assert.throws(
    () => build({ allOf: [{ type: 'object', default: defaultValue }] }),
    { message: 'schema exceeds maximum depth of 100' }
  )
})

test('supports a configurable maximum schema depth', (t) => {
  t.assert.throws(
    () => build(createNestedSchema(3), { maxDepth: 2 }),
    { message: 'schema exceeds maximum depth of 2' }
  )
  t.assert.throws(
    () => build({ not: { not: { not: { type: 'string' } } } }, { maxDepth: 2 }),
    { message: 'schema exceeds maximum depth of 2' }
  )
  t.assert.doesNotThrow(() => build(createNestedSchema(3), { maxDepth: 3 }))
  t.assert.doesNotThrow(() => build({ type: 'string' }, { maxDepth: 0 }))
  t.assert.doesNotThrow(() => build(false, { maxDepth: 0 }))
  t.assert.throws(
    () => build({ type: 'object', properties: { value: true } }, { maxDepth: 0 }),
    { message: 'schema exceeds maximum depth of 0' }
  )
})

test('rejects invalid maximum schema depths', (t) => {
  t.assert.throws(() => build(null), { message: /^schema is invalid:/ })
  t.assert.throws(
    () => build({}, { maxDepth: '100' }),
    { message: 'Unsupported max schema depth 100. Expected an integer between 0 and 100.' }
  )
  t.assert.throws(
    () => build({}, { maxDepth: -1 }),
    { message: 'Unsupported max schema depth -1. Expected an integer between 0 and 100.' }
  )
  t.assert.throws(
    () => build({}, { maxDepth: 101 }),
    { message: 'Unsupported max schema depth 101. Expected an integer between 0 and 100.' }
  )
})

test('checks schema dependencies without treating property lists as schemas', (t) => {
  t.assert.doesNotThrow(() => build({
    type: 'object',
    dependencies: {
      enabled: { properties: { value: { type: 'string' } } },
      value: ['enabled']
    }
  }, { maxDepth: 2 }))
})

test('checks external schemas before validating them recursively', (t) => {
  t.assert.throws(
    () => build({ type: 'string' }, {
      maxDepth: 1,
      schema: { external: createNestedSchema(2) }
    }),
    { message: '"external" schema exceeds maximum depth of 1' }
  )
})

test('counts nested schema levels reached through external references', (t) => {
  const externalSchemas = {
    first: {
      $id: 'first',
      type: 'object',
      properties: { value: { $ref: 'second' } }
    },
    second: {
      $id: 'second',
      type: 'object',
      properties: { value: { $ref: 'third' } }
    },
    third: {
      $id: 'third',
      type: 'object',
      properties: { value: { type: 'string' } }
    }
  }

  t.assert.throws(
    () => build({ $ref: 'first' }, { maxDepth: 1, schema: externalSchemas }),
    { message: 'schema exceeds maximum depth of 1' }
  )
  t.assert.doesNotThrow(() => build({ $ref: 'first' }, { maxDepth: 3, schema: externalSchemas }))
})

test('limits reference chains reached through validator-only keywords', (t) => {
  const externalSchemas = {}
  const dependencyCount = 1000

  for (let i = 0; i < dependencyCount; i++) {
    externalSchemas[`dependency-${i}`] = {
      $id: `dependency-${i}`,
      ...(i + 1 < dependencyCount
        ? { $ref: `dependency-${i + 1}` }
        : { type: 'string' })
    }
  }

  const schema = {
    anyOf: [{ not: { $ref: 'dependency-0' } }]
  }

  for (const compileValidators of [false, true]) {
    t.assert.throws(
      () => build(schema, { compileValidators, schema: externalSchemas }),
      { message: 'schema exceeds maximum depth of 100' }
    )
  }
})

test('walks references in non-schema values without recursive dependency discovery', (t) => {
  const externalSchemas = {}
  const dependencyCount = 10000

  for (let i = 0; i < dependencyCount; i++) {
    externalSchemas[`annotation-${i}`] = {
      $id: `annotation-${i}`,
      $ref: i + 1 < dependencyCount ? `annotation-${i + 1}` : 'root'
    }
  }

  t.assert.doesNotThrow(() => build({
    $id: 'root',
    type: 'string',
    anyOf: [{ type: 'string' }],
    default: { $ref: 'annotation-0' }
  }, { schema: externalSchemas }))
})

test('limits and detects reference-only chains', (t) => {
  const externalSchemas = {
    first: { $id: 'first', $ref: 'second' },
    second: { $id: 'second', $ref: 'third' },
    third: { $id: 'third', type: 'string' }
  }

  t.assert.throws(
    () => build({ $ref: 'first' }, { maxDepth: 1, schema: externalSchemas }),
    { message: 'schema exceeds maximum depth of 1' }
  )

  externalSchemas.third = { $id: 'third', $ref: 'first' }
  t.assert.throws(
    () => build({ $ref: 'first' }, { schema: externalSchemas }),
    { message: 'Cannot resolve circular reference "second"' }
  )
})

test('rejects circular object graphs before schema validation', (t) => {
  const schema = { type: 'object', properties: {} }
  schema.properties.self = schema

  t.assert.throws(
    () => build(schema),
    { message: 'schema contains a circular object reference; use $ref instead' }
  )
})
