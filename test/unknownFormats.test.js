'use strict'

const { describe } = require('node:test')
const build = require('..')

describe('object with custom format field', (t) => {
  const schema = {
    title: 'object with custom format field',
    type: 'object',
    properties: {
      str: {
        type: 'string',
        format: 'test-format'
      }
    }
  }

  const stringify = build(schema)

  stringify({
    str: 'string'
  })
})
