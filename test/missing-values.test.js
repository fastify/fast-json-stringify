'use strict'

const test = require('tap').test
const build = require('..')

test('missing values', (t) => {
  t.plan(3)

  const stringify = build({
    title: 'object with missing values',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'number'
      },
      val: {
        type: 'string'
      }
    }
  })

  t.equal('{"val":"value"}', stringify({ val: 'value' }))
  t.equal('{"str":"string","val":"value"}', stringify({ str: 'string', val: 'value' }))
  t.equal('{"str":"string","num":42,"val":"value"}', stringify({ str: 'string', num: 42, val: 'value' }))
})

test('handle null when value should be string', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      str: {
        type: 'string'
      }
    }
  })

  t.equal('{"str":""}', stringify({ str: null }))
})

test('handle null when value should be integer', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      int: {
        type: 'integer'
      }
    }
  })

  t.equal('{"int":0}', stringify({ int: null }))
})

test('handle null when value should be number', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      num: {
        type: 'number'
      }
    }
  })

  t.equal('{"num":0}', stringify({ num: null }))
})

test('handle null when value should be boolean', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      bool: {
        type: 'boolean'
      }
    }
  })

  t.equal('{"bool":false}', stringify({ bool: null }))
})
