'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('render a bigint as JSON', () => {
  const schema = {
    title: 'bigint',
    type: 'integer'
  }

  const stringify = build(schema)
  const output = stringify(1615n)

  equal(output, '1615')
})

describe('render an object with a bigint as JSON', () => {
  const schema = {
    title: 'object with bigint',
    type: 'object',
    properties: {
      id: {
        type: 'integer'
      }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    id: 1615n
  })

  equal(output, '{"id":1615}')
})

describe('render an array with a bigint as JSON', () => {
  const schema = {
    title: 'array with bigint',
    type: 'array',
    items: {
      type: 'integer'
    }
  }

  const stringify = build(schema)
  const output = stringify([1615n])

  equal(output, '[1615]')
})

describe('render an object with an additionalProperty of type bigint as JSON', () => {
  const schema = {
    title: 'object with bigint',
    type: 'object',
    additionalProperties: {
      type: 'integer'
    }
  }

  const stringify = build(schema)
  const output = stringify({
    num: 1615n
  })

  equal(output, '{"num":1615}')
})
