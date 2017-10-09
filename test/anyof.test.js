'use strict'

const test = require('tap').test
const build = require('..')

test('object with multiple types field', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with multiple types field',
    type: 'object',
    properties: {
      str: {
        'anyOf': [{
          type: 'string'
        }, {
          type: 'boolean'
        }]
      }
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      str: 'string'
    })
    t.is(value, '{"str":"string"}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      str: true
    })
    t.is(value, '{"str":true}')
  } catch (e) {
    t.fail()
  }
})
