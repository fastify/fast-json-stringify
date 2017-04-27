'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const Long = require('long')
const build = require('..')

test(`render a long as JSON`, (t) => {
  t.plan(2)

  const schema = {
    title: 'long',
    type: 'integer'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(Long.fromString('18446744073709551615', true))

  t.equal(output, '18446744073709551615')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})
