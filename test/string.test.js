'use strict'

const { describe } = require('node:test')
const { deepStrictEqual, throws } = require('node:assert')
const build = require('..')

describe('serialize short string', (t) => {
  const schema = {
    type: 'string'
  }

  const input = 'abcd'
  const stringify = build(schema)
  const output = stringify(input)

  deepStrictEqual(output, '"abcd"')
  deepStrictEqual(JSON.parse(output), input)
})

describe('serialize short string', (t) => {
  const schema = {
    type: 'string'
  }

  const input = '\x00'
  const stringify = build(schema)
  const output = stringify(input)

  deepStrictEqual(output, '"\\u0000"')
  deepStrictEqual(JSON.parse(output), input)
})

describe('serialize long string', (t) => {
  const schema = {
    type: 'string'
  }

  const input = new Array(2e4).fill('\x00').join('')
  const stringify = build(schema)
  const output = stringify(input)

  deepStrictEqual(output, `"${new Array(2e4).fill('\\u0000').join('')}"`)
  deepStrictEqual(JSON.parse(output), input)
})

describe('unsafe string', (t) => {
  const schema = {
    type: 'string',
    format: 'unsafe'
  }

  const input = 'abcd'
  const stringify = build(schema)
  const output = stringify(input)

  deepStrictEqual(output, `"${input}"`)
  deepStrictEqual(JSON.parse(output), input)
})

describe('unsafe unescaped string', (t) => {
  const schema = {
    type: 'string',
    format: 'unsafe'
  }

  const input = 'abcd "abcd"'
  const stringify = build(schema)
  const output = stringify(input)

  deepStrictEqual(output, `"${input}"`)
  throws(() => {
    JSON.parse(output)
  })
})
