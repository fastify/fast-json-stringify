'use strict'

const test = require('tap').test
const build = require('..')

test('type not supported', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with RegExp',
    type: 'object',
    properties: {
      reg: 'string'
    }
  }

  try {
    build(schema)
  } catch (err) {
    t.equal(err.message, `undefined unsupported in schema:\n${JSON.stringify(schema, null, 2)}`)
  }
})

test('type not supported - nested', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with RegExp',
    type: 'object',
    properties: {
      key: {
        type: 'object',
        properties: {
          key: 'number'
        }
      }
    }
  }

  try {
    build(schema)
  } catch (err) {
    t.equal(err.message, `undefined unsupported in schema:\n${JSON.stringify(schema, null, 2)}`)
  }
})
