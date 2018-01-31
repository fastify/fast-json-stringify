'use strict'

const test = require('tap').test
const build = require('..')

test('object with required field', (t) => {
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

  try {
    stringify({
      num: 42
    })
    t.fail()
  } catch (e) {
    t.is(e.message, 'str is required!')
    t.pass()
  }
})

test('required numbers', (t) => {
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
    required: ['num']
  }
  const stringify = build(schema)

  try {
    stringify({
      num: 42
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  try {
    stringify({
      num: 'aaa'
    })
    t.fail()
  } catch (e) {
    t.is(e.message, 'num is required!')
    t.pass()
  }
})
