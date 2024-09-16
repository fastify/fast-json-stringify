'use strict'

const { describe } = require('node:test')
const { ok, equal, throws } = require('node:assert')
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

describe('activate debug mode', () => {
  const debugMode = build({ debugMode: true })

  ok(typeof debugMode === 'object')
  ok(debugMode.ajv instanceof Ajv)
  ok(debugMode.validator instanceof Validator)
  ok(debugMode.serializer instanceof Serializer)
  ok(typeof debugMode.code === 'string')
})

describe('activate debug mode truthy', () => {
  const debugMode = build({ debugMode: 'yes' })

  ok(typeof debugMode === 'object')
  ok(typeof debugMode.code === 'string')
  ok(debugMode.ajv instanceof Ajv)
  ok(debugMode.validator instanceof Validator)
  ok(debugMode.serializer instanceof Serializer)
})

describe('to string auto-consistent', () => {
  const debugMode = build({ debugMode: 1 })

  ok(typeof debugMode === 'object')
  ok(typeof debugMode.code === 'string')
  ok(debugMode.ajv instanceof Ajv)
  ok(debugMode.serializer instanceof Serializer)
  ok(debugMode.validator instanceof Validator)

  const compiled = fjs.restore(debugMode)
  const tobe = JSON.stringify({ firstName: 'Foo' })
  equal(compiled({ firstName: 'Foo', surname: 'bar' }), tobe, 'surname evicted')
})

describe('to string auto-consistent with ajv', () => {
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

  ok(typeof debugMode === 'object')
  ok(typeof debugMode.code === 'string')
  ok(debugMode.ajv instanceof Ajv)
  ok(debugMode.validator instanceof Validator)
  ok(debugMode.serializer instanceof Serializer)

  const compiled = fjs.restore(debugMode)
  const tobe = JSON.stringify({ str: 'Foo' })
  equal(compiled({ str: 'Foo', void: 'me' }), tobe)
})

describe('to string auto-consistent with ajv-formats', () => {
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

  ok(typeof debugMode === 'object')

  const compiled = fjs.restore(debugMode)
  const tobe = JSON.stringify({ str: 'foo@bar.com' })
  equal(compiled({ str: 'foo@bar.com' }), tobe)
  throws(() => compiled({ str: 'foo' }))
})

describe('debug should restore the same serializer instance', () => {
  const debugMode = fjs({ type: 'integer' }, { debugMode: 1, rounding: 'ceil' })
  const compiled = fjs.restore(debugMode)
  equal(compiled(3.95), 4)
})
