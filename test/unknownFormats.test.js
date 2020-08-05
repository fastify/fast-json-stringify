'use strict'

const test = require('tap').test
const build = require('..')

test('object with custom format field', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with custom format field',
    type: 'object',
    properties: {
      str: {
        type: 'string',
        format: 'test-format'
      }
    }
  }

  const stringify = build(schema)

  stringify({
    str: 'string'
  })

  t.pass()
})
