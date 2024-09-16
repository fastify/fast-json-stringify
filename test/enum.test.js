'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('use enum without type', (t) => {
  const stringify = build({
    title: 'Example Schema',
    type: 'object',
    properties: {
      order: {
        type: 'string',
        enum: ['asc', 'desc']
      }
    }
  })

  const obj = { order: 'asc' }
  equal('{"order":"asc"}', stringify(obj))
})

describe('use enum without type', (t) => {
  const stringify = build({
    title: 'Example Schema',
    type: 'object',
    properties: {
      order: {
        enum: ['asc', 'desc']
      }
    }
  })

  const obj = { order: 'asc' }
  equal('{"order":"asc"}', stringify(obj))
})
