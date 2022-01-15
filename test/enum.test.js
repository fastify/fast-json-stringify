'use strict'

const test = require('tap').test
const build = require('..')

test('use enum without type', (t) => {
  t.plan(1)
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
  t.equal('{"order":"asc"}', stringify(obj))
})

test('use enum without type', (t) => {
  t.plan(1)
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
  t.equal('{"order":"asc"}', stringify(obj))
})
