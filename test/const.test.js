'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('..')

test('schema with const string', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: 'bar'
  })

  t.equal(output, '{"foo":"bar"}')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('schema with const object', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: { bar: 'baz' } }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: { bar: 'baz' }
  })

  t.equal(output, '{"foo":{"bar":"baz"}}')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('schema with const and invalid object', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: { foo: 'bar' } }
    },
    required: ['foo']
  }

  const stringify = build(schema)
  try {
    stringify({
      foo: { foo: 'baz' }
    })
  } catch (err) {
    t.match(err.message, /^Item .* does not match schema definition/, 'Given object has invalid const value')
    t.ok(err)
  }
})
