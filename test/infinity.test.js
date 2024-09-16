'use strict'

const { test } = require('node:test')
const { throws, equal } = require('node:assert')
const build = require('..')

test('Finite numbers', t => {
  const values = [-5, 0, -0, 1.33, 99, 100.0,
    Math.E, Number.EPSILON,
    Number.MAX_SAFE_INTEGER, Number.MAX_VALUE,
    Number.MIN_SAFE_INTEGER, Number.MIN_VALUE]

  const schema = {
    type: 'number'
  }

  const stringify = build(schema)

  values.forEach(v => equal(stringify(v), JSON.stringify(v)))
})

test('Infinite integers', t => {
  const values = [Infinity, -Infinity]

  const schema = {
    type: 'integer'
  }

  const stringify = build(schema)

  values.forEach(v => {
    throws(() => {
      stringify(v)
    }, {
      message: `The value "${v}" cannot be converted to an integer.`
    })
  })
})

test('Infinite numbers', t => {
  const values = [Infinity, -Infinity]

  const schema = {
    type: 'number'
  }

  const stringify = build(schema)

  values.forEach(v => equal(stringify(v), JSON.stringify(v)))
})
