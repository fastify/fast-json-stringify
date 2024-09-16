'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('nested ref requires ajv', async t => {
  const schemaA = {
    $id: 'urn:schema:a',
    definitions: {
      foo: { anyOf: [{ type: 'string' }, { type: 'null' }] }
    }
  }

  const schemaB = {
    $id: 'urn:schema:b',
    type: 'object',
    properties: {
      results: {
        type: 'object',
        properties: {
          items: {
            type: 'object',
            properties: {
              bar: {
                type: 'array',
                items: { $ref: 'urn:schema:a#/definitions/foo' }
              }
            }
          }
        }
      }
    }
  }

  const stringify = build(schemaB, {
    schema: {
      [schemaA.$id]: schemaA
    }
  })
  const result = stringify({
    results: {
      items: {
        bar: ['baz']
      }
    }
  })
  equal(result, '{"results":{"items":{"bar":["baz"]}}}')
})
