'use strict'

const test = require('tap').test
const { validate } = require('./util')
const build = require('..')

test('object with RexExp', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with RegExp',
    type: 'object',
    properties: {
      reg: {
        type: 'string'
      }
    }
  }

  const obj = {
    reg: /"([^"]|\\")*"/
  }

  const stringify = build(schema)
  const output = stringify(obj)

  JSON.parse(output)
  t.pass()

  t.equal(obj.reg.source, new RegExp(JSON.parse(output).reg).source)
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})
