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

  try {
    const value = stringify({
      stringProperty: 'string1',
      objectProperty: {
        stringProperty: 'string2',
        numberProperty: 42
      }
    })
    t.is(value, '{"stringProperty":"string1","objectProperty":{"stringProperty":"string2","numberProperty":42}}')
  } catch (e) {
    t.fail()
  }
})
