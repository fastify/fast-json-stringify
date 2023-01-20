'use strict'

const t = require('tap')
const test = t.test
const build = require('..')

test('serialize short string', (t) => {
  t.plan(2)

  const schema = {
    type: 'string'
  }

  const input = 'abcd'
  const stringify = build(schema)
  const output = stringify(input)

  t.equal(output, '"abcd"')
  t.equal(JSON.parse(output), input)
})

test('serialize short string', (t) => {
  t.plan(2)

  const schema = {
    type: 'string'
  }

  const input = '\x00'
  const stringify = build(schema)
  const output = stringify(input)

  t.equal(output, '"\\u0000"')
  t.equal(JSON.parse(output), input)
})

test('serialize long string', (t) => {
  t.plan(2)

  const schema = {
    type: 'string'
  }

  const input = new Array(2e4).fill('\x00').join('')
  const stringify = build(schema)
  const output = stringify(input)

  t.equal(output, `"${new Array(2e4).fill('\\u0000').join('')}"`)
  t.equal(JSON.parse(output), input)
})
