'use strict'

const { test } = require('tap')
const clone = require('rfdc/default')
const build = require('..')

test('oneOf with $ref should not change the input schema', t => {
  t.plan(2)

  const referenceSchema = {
    $id: 'externalId',
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  const schema = {
    $id: 'mainSchema',
    type: 'object',
    properties: {
      people: {
        oneOf: [{ $ref: 'externalId' }]
      }
    }
  }
  const clonedSchema = clone(schema)
  const stringify = build(schema, {
    schema: {
      [referenceSchema.$id]: referenceSchema
    }
  })

  const value = stringify({ people: { name: 'hello', foo: 'bar' } })
  t.is(value, '{"people":{"name":"hello"}}')
  t.deepEqual(schema, clonedSchema)
})

test('oneOf and anyOf with $ref should not change the input schema', t => {
  t.plan(3)

  const referenceSchema = {
    $id: 'externalSchema',
    type: 'object',
    properties: {
      name: { type: 'string' }
    }
  }

  const schema = {
    $id: 'rootSchema',
    type: 'object',
    properties: {
      people: {
        oneOf: [{ $ref: 'externalSchema' }]
      },
      love: {
        anyOf: [
          { $ref: '#/definitions/foo' },
          { type: 'boolean' }
        ]
      }
    },
    definitions: {
      foo: { type: 'string' }
    }
  }
  const clonedSchema = clone(schema)
  const stringify = build(schema, {
    schema: {
      [referenceSchema.$id]: referenceSchema
    }
  })

  const valueAny1 = stringify({ people: { name: 'hello', foo: 'bar' }, love: 'music' })
  const valueAny2 = stringify({ people: { name: 'hello', foo: 'bar' }, love: true })

  t.equal(valueAny1, '{"people":{"name":"hello"},"love":"music"}')
  t.equal(valueAny2, '{"people":{"name":"hello"},"love":true}')
  t.deepEqual(schema, clonedSchema)
})

test('multiple $ref tree', t => {
  t.plan(2)

  const referenceDeepSchema = {
    $id: 'deepId',
    type: 'number'
  }

  const referenceSchema = {
    $id: 'externalId',
    type: 'object',
    properties: {
      name: { $ref: '#/definitions/foo' },
      age: { $ref: 'deepId' }
    },
    definitions: {
      foo: { type: 'string' }
    }
  }

  const schema = {
    $id: 'mainSchema',
    type: 'object',
    properties: {
      people: {
        oneOf: [{ $ref: 'externalId' }]
      }
    }
  }
  const clonedSchema = clone(schema)
  const stringify = build(schema, {
    schema: {
      [referenceDeepSchema.$id]: referenceDeepSchema,
      [referenceSchema.$id]: referenceSchema
    }
  })

  const value = stringify({ people: { name: 'hello', foo: 'bar', age: 42 } })
  t.is(value, '{"people":{"name":"hello","age":42}}')
  t.deepEqual(schema, clonedSchema)
})

test('must not mutate items $ref', t => {
  t.plan(2)

  const referenceSchema = {
    $id: 'ShowSchema',
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      }
    }
  }

  const schema = {
    $id: 'ListSchema',
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'array',
    items: {
      $ref: 'ShowSchema#'
    }
  }
  const clonedSchema = clone(schema)
  const stringify = build(schema, {
    schema: {
      [referenceSchema.$id]: referenceSchema
    }
  })

  const value = stringify([{ name: 'foo' }])
  t.is(value, '[{"name":"foo"}]')
  t.deepEqual(schema, clonedSchema)
})
