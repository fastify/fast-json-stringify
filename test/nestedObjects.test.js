'use strict'

const test = require('tap').test
const build = require('..')

test('nested objects with same properties', (t) => {
  t.plan(1)

  const schema = {
    title: 'nested objects with same properties',
    type: 'object',
    properties: {
      stringProperty: {
        type: 'string'
      },
      objectProperty: {
        type: 'object',
        additionalProperties: true
      }
    }
  }
  const stringify = build(schema)

  const value = stringify({
    stringProperty: 'string1',
    objectProperty: {
      stringProperty: 'string2',
      numberProperty: 42
    }
  })
  t.equal(value, '{"stringProperty":"string1","objectProperty":{"stringProperty":"string2","numberProperty":42}}')
})

test('names collision', (t) => {
  t.plan(1)

  const schema = {
    title: 'nested objects with same properties',
    type: 'object',
    properties: {
      test: {
        type: 'object',
        properties: {
          a: { type: 'string' }
        }
      },
      tes: {
        type: 'object',
        properties: {
          b: { type: 'string' },
          t: { type: 'object' }
        }
      }
    }
  }
  const stringify = build(schema)
  const data = {
    test: { a: 'a' },
    tes: { b: 'b', t: {} }
  }

  t.equal(stringify(data), JSON.stringify(data))
})
