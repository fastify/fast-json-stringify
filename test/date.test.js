'use strict'

const test = require('tap').test
const moment = require('moment')
const validator = require('is-my-json-valid')
const build = require('..')

test('render a date in a string as JSON', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string'
  }
  const toStringify = new Date()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render an object in a string when type is date-format as ISOString', (t) => {
  t.plan(2)

  const schema = {
    title: 'an object in a string',
    type: 'string',
    format: 'date-time'
  }
  const toStringify = moment()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})
