'use strict'

const test = require('tap').test
const build = require('..')

test('no-throw option should work', t => {
  t.plan(3)

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
    required: ['str', 'num']
  }
  const stringify = build(schema, { noThrow: true })

  try {
    const valid = stringify({
      str: 'string'
    })
    t.is(JSON.stringify(valid), '{"error":"\'num\' is required"}')
    t.pass()
  } catch (e) {
    t.fail()
  }

  try {
    stringify({
      str: 'string'
    })
    t.pass()
  } catch (e) {
    t.is(e.message, 'str is required!')
    t.fail()
  }
})

test('no no-throw option should work as default', t => {
  t.plan(3)

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
    required: ['str', 'num']
  }
  const stringify = build(schema)

  try {
    stringify({
      str: 'string'
    })
    t.fail()
  } catch (e) {
    t.pass()
  }

  try {
    stringify({
      str: 'string'
    })
    t.fail()
  } catch (e) {
    t.is(e.message, 'num is required!')
    t.pass()
  }
})
