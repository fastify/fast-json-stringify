'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('nested objects with same properties', (t) => {
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
  equal(value, '{"stringProperty":"string1","objectProperty":{"stringProperty":"string2","numberProperty":42}}')
})

describe('names collision', (t) => {
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

  equal(stringify(data), JSON.stringify(data))
})
