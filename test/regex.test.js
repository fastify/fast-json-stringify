'use strict'

const { describe } = require('node:test')
const { equal, ok } = require('node:assert')
const validator = require('is-my-json-valid')
const build = require('..')

describe('object with RexExp', (t) => {
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
  const validate = validator(schema)
  const output = stringify(obj)

  JSON.parse(output)

  equal(obj.reg.source, new RegExp(JSON.parse(output).reg).source)
  ok(validate(JSON.parse(output)), 'valid schema')
})
