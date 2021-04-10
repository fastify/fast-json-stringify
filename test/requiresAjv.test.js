'use strict'

const t = require('tap')
const build = require('..')

t.test('nested ref requires ajv', async t => {
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
  t.same(result, '{"results":{"items":{"bar":["baz"]}}}')
})
