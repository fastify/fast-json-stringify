'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('missing values', (t) => {
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

  equal('{"val":"value"}', stringify({ val: 'value' }))
  equal('{"str":"string","val":"value"}', stringify({ str: 'string', val: 'value' }))
  equal('{"str":"string","num":42,"val":"value"}', stringify({ str: 'string', num: 42, val: 'value' }))
})

describe('handle null when value should be string', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      str: {
        type: 'string'
      }
    }
  })

  equal('{"str":""}', stringify({ str: null }))
})

describe('handle null when value should be integer', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      int: {
        type: 'integer'
      }
    }
  })

  equal('{"int":0}', stringify({ int: null }))
})

describe('handle null when value should be number', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      num: {
        type: 'number'
      }
    }
  })

  equal('{"num":0}', stringify({ num: null }))
})

describe('handle null when value should be boolean', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      bool: {
        type: 'boolean'
      }
    }
  })

  equal('{"bool":false}', stringify({ bool: null }))
})
