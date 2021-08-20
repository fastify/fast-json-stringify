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
  t.equal(value, '{"people":{"name":"hello"}}')
  t.same(schema, clonedSchema)
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
  t.same(schema, clonedSchema)
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
  t.equal(value, '{"people":{"name":"hello","age":42}}')
  t.same(schema, clonedSchema)
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
  t.equal(value, '[{"name":"foo"}]')
  t.same(schema, clonedSchema)
})

test('must not mutate input schema', t => {
  t.plan(2)

  const ext1 = {
    $id: 'http://foo/item',
    type: 'object',
    properties: { foo: { type: 'string' } }
  }
  const ext2 = {
    $id: 'itemList',
    type: 'array',
    items: { $ref: 'http://foo/item#' }
  }
  const ext3 = {
    $id: 'encapsulation',
    type: 'object',
    properties: {
      id: { type: 'number' },
      item: { $ref: 'http://foo/item#' },
      secondItem: { $ref: 'http://foo/item#' }
    }
  }

  const schema = {
    type: 'object',
    properties: {
      a: { $ref: 'itemList#' },
      b: { $ref: 'http://foo/item#' },
      c: { $ref: 'http://foo/item#' },
      d: { $ref: 'http://foo/item#' }
    }
  }
  const clonedSchema = clone(schema)
  const stringify = build(schema, {
    schema: {
      [ext1.$id]: ext1,
      [ext2.$id]: ext2,
      [ext3.$id]: ext3
    }
  })

  const value = stringify({
    a: [{ foo: 'a' }],
    b: { foo: 'b' },
    c: { foo: 'c' },
    d: { foo: 'd' }
  })
  t.equal(value, '{"a":[{"foo":"a"}],"b":{"foo":"b"},"c":{"foo":"c"},"d":{"foo":"d"}}')
  t.same(schema, clonedSchema)
})
