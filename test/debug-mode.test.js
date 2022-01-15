'use strict'

const test = require('tap').test
const fjs = require('..')

function build (opts) {
  return fjs({
    title: 'default string',
    type: 'object',
    properties: {
      firstName: {
        type: 'string'
      }
    },
    required: ['firstName']
  }, opts)
}

test('activate debug mode', t => {
  t.plan(2)
  const debugMode = build({ debugMode: true })
  t.type(debugMode, Array)
  t.match(debugMode.toString.toString(), 'join', 'to string override')
})

test('activate debug mode truthy', t => {
  t.plan(2)
  const debugMode = build({ debugMode: 'yes' })
  t.type(debugMode, Array)
  t.match(debugMode.toString.toString(), 'join', 'to string override')
})

test('to string auto-consistent', t => {
  t.plan(2)
  const debugMode = build({ debugMode: 1 })
  t.type(debugMode, Array)

  const str = debugMode.toString()
  const compiled = fjs.restore(str)
  const tobe = JSON.stringify({ firstName: 'Foo' })
  t.same(compiled({ firstName: 'Foo', surname: 'bar' }), tobe, 'surname evicted')
})

test('to string auto-consistent with ajv', t => {
  t.plan(2)
  const debugMode = fjs({
    title: 'object with multiple types field',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string'
        }, {
          type: 'boolean'
        }]
      }
    }
  }, { debugMode: 1 })
  t.type(debugMode, Array)

  const str = debugMode.toString()
  const compiled = fjs.restore(str)
  const tobe = JSON.stringify({ str: 'Foo' })
  t.same(compiled({ str: 'Foo', void: 'me' }), tobe)
})

test('to string auto-consistent with ajv-formats', t => {
  t.plan(3)
  const debugMode = fjs({
    title: 'object with multiple types field and format keyword',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string',
          format: 'email'
        }, {
          type: 'boolean'
        }]
      }
    }
  }, { debugMode: 1 })
  t.type(debugMode, Array)

  const str = debugMode.toString()

  const compiled = fjs.restore(str)
  const tobe = JSON.stringify({ str: 'foo@bar.com' })
  t.same(compiled({ str: 'foo@bar.com' }), tobe)
  t.same(compiled({ str: 'foo' }), JSON.stringify({ str: null }), 'invalid format is ignored')
})
