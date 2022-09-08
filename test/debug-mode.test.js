'use strict'

const test = require('tap').test
const fjs = require('..')

const Ajv = require('ajv').default
const Validator = require('../lib/validator')
const Serializer = require('../lib/serializer')

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
  t.plan(5)
  const debugMode = build({ debugMode: true })

  t.type(debugMode, 'object')
  t.ok(debugMode.ajv instanceof Ajv)
  t.ok(debugMode.validator instanceof Validator)
  t.ok(debugMode.serializer instanceof Serializer)
  t.type(debugMode.code, 'string')
})

test('activate debug mode truthy', t => {
  t.plan(5)

  const debugMode = build({ debugMode: 'yes' })

  t.type(debugMode, 'object')
  t.type(debugMode.code, 'string')
  t.ok(debugMode.ajv instanceof Ajv)
  t.ok(debugMode.validator instanceof Validator)
  t.ok(debugMode.serializer instanceof Serializer)
})

test('to string auto-consistent', t => {
  t.plan(6)
  const debugMode = build({ debugMode: 1 })

  t.type(debugMode, 'object')
  t.type(debugMode.code, 'string')
  t.ok(debugMode.ajv instanceof Ajv)
  t.ok(debugMode.serializer instanceof Serializer)
  t.ok(debugMode.validator instanceof Validator)

  const compiled = fjs.restore(debugMode)
  const tobe = JSON.stringify({ firstName: 'Foo' })
  t.same(compiled({ firstName: 'Foo', surname: 'bar' }), tobe, 'surname evicted')
})

test('to string auto-consistent with ajv', t => {
  t.plan(6)

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

  t.type(debugMode, 'object')
  t.type(debugMode.code, 'string')
  t.ok(debugMode.ajv instanceof Ajv)
  t.ok(debugMode.validator instanceof Validator)
  t.ok(debugMode.serializer instanceof Serializer)

  const compiled = fjs.restore(debugMode)
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

  t.type(debugMode, 'object')

  const compiled = fjs.restore(debugMode)
  const tobe = JSON.stringify({ str: 'foo@bar.com' })
  t.same(compiled({ str: 'foo@bar.com' }), tobe)
  t.throws(() => compiled({ str: 'foo' }))
})

test('debug should restore the same serializer instance', t => {
  t.plan(1)

  const debugMode = fjs({ type: 'integer' }, { debugMode: 1, rounding: 'ceil' })
  const compiled = fjs.restore(debugMode)
  t.same(compiled(3.95), 4)
})
