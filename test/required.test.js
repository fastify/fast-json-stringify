'use strict'

const test = require('tap').test
const build = require('..')

test('object with required field', (t) => {
  t.plan(2
  )

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'integer'
      }
    },
    required: ['str']
  }
  const stringify = build(schema)

  try {
    stringify({
      str: 'string'
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  const e = stringify({
    num: 42
  })
  t.is(e.message, 'str is required!')
})
