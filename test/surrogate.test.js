'use strict'

const { describe } = require('node:test')
const { equal, ok } = require('node:assert')
const validator = require('is-my-json-valid')
const build = require('..')

describe('render a string with surrogate pairs as JSON:test 1', (t) => {
  const schema = {
    title: 'surrogate',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('𝌆')

  equal(output, '"𝌆"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a string with surrogate pairs as JSON: test 2', (t) => {
  const schema = {
    title: 'long',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('\uD834\uDF06')

  equal(output, '"𝌆"')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a string with Unpaired surrogate code as JSON', (t) => {
  const schema = {
    title: 'surrogate',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('\uDF06\uD834')
  equal(output, JSON.stringify('\uDF06\uD834'))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a string with lone surrogate code as JSON', (t) => {
  const schema = {
    title: 'surrogate',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('\uDEAD')
  equal(output, JSON.stringify('\uDEAD'))
  ok(validate(JSON.parse(output)), 'valid schema')
})
