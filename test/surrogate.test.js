'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('..')

test(`render a string with surrogate pairs as JSON:test 1`, (t) => {
  t.plan(2)

  const schema = {
    title: 'surrogate',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('𝌆')

  t.equal(output, '"𝌆"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test(`render a string with surrogate pairs as JSON: test 2`, (t) => {
  t.plan(2)

  const schema = {
    title: 'long',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('\uD834\uDF06')

  t.equal(output, '"𝌆"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test(`render a string with Unpaired surrogate code as JSON`, (t) => {
  t.plan(1)

  const schema = {
    title: 'surrogate',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('\uDF06\uD834')

  console.log('++++++++++++++++++++', JSON.parse(output))
  console.log('++++++++++++++++++++', validate(JSON.parse(output)))
  t.equal(output, '"\\udf06\\ud834"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test(`render a string with lone surrogate code as JSON`, (t) => {
  t.plan(1)

  const schema = {
    title: 'surrogate',
    type: 'string'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify('\uDEAD')

  console.log('++++++++++++++++++++', JSON.parse(output))
  console.log('++++++++++++++++++++', validate(JSON.parse(output)))
  t.equal(output, '"\\udead"')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})
