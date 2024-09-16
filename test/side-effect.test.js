'use strict'

const { describe } = require('node:test')
const { equal, deepStrictEqual } = require('node:assert')
const clone = require('rfdc/default')
const build = require('..')

describe('oneOf with $ref should not change the input schema', t => {
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
  equal(value, '{"people":{"name":"hello"}}')
  deepStrictEqual(schema, clonedSchema)
})

describe('oneOf and anyOf with $ref should not change the input schema', t => {
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

  equal(valueAny1, '{"people":{"name":"hello"},"love":"music"}')
  equal(valueAny2, '{"people":{"name":"hello"},"love":true}')
  deepStrictEqual(schema, clonedSchema)
})

describe('multiple $ref tree', t => {
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
  equal(value, '{"people":{"name":"hello","age":42}}')
  deepStrictEqual(schema, clonedSchema)
})

describe('must not mutate items $ref', t => {
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
  equal(value, '[{"name":"foo"}]')
  deepStrictEqual(schema, clonedSchema)
})

describe('must not mutate items referred by $ref', t => {
  const firstSchema = {
    $id: 'example1',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      }
    }
  }

  const reusedSchema = {
    $id: 'example2',
    type: 'object',
    properties: {
      name: {
        oneOf: [
          {
            $ref: 'example1'
          }
        ]
      }
    }
  }

  const clonedSchema = clone(firstSchema)
  const stringify = build(reusedSchema, {
    schema: {
      [firstSchema.$id]: firstSchema
    }
  })

  const value = stringify({ name: { name: 'foo' } })
  equal(value, '{"name":{"name":"foo"}}')
  deepStrictEqual(firstSchema, clonedSchema)
})
