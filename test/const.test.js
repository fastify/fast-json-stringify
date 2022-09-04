'use strict'

const test = require('tap').test
const { validate } = require('./util')
const build = require('..')

test('schema with const string', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: 'bar'
  })

  t.equal(output, '{"foo":"bar"}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const string and different input', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: 'baz'
  })

  t.equal(output, '{"foo":"bar"}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const string and different type input', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: 1
  })

  t.equal(output, '{"foo":"bar"}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const string and no input', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const stringify = build(schema)
  const output = stringify({})

  t.equal(output, '{}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const number', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: 1
  })

  t.equal(output, '{"foo":1}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const number and different input', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: 2
  })

  t.equal(output, '{"foo":1}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const bool', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: true }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: true
  })

  t.equal(output, '{"foo":true}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const number', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: 1
  })

  t.equal(output, '{"foo":1}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const null', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: null }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: null
  })

  t.equal(output, '{"foo":null}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const array', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: [1, 2, 3] }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: [1, 2, 3]
  })

  t.equal(output, '{"foo":[1,2,3]}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const object', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: { bar: 'baz' } }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: { bar: 'baz' }
  })

  t.equal(output, '{"foo":{"bar":"baz"}}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')
})

test('schema with const and null as type', (t) => {
  t.plan(4)

  const schema = {
    type: 'object',
    properties: {
      foo: { type: ['string', 'null'], const: 'baz' }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: null
  })

  t.equal(output, '{"foo":"baz"}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')

  const output2 = stringify({ foo: 'baz' })
  t.equal(output2, '{"foo":"baz"}')
  t.ok(validate(JSON.parse(output2), schema), 'valid schema')
})

test('schema with const as nullable', (t) => {
  t.plan(4)

  const schema = {
    type: 'object',
    properties: {
      foo: { type: 'string', nullable: true, const: 'baz' }
    }
  }

  const stringify = build(schema)
  const output = stringify({
    foo: null
  })

  t.equal(output, '{"foo":"baz"}')
  t.ok(validate(JSON.parse(output), schema), 'valid schema')

  const output2 = stringify({
    foo: 'baz'
  })
  t.equal(output2, '{"foo":"baz"}')
  t.ok(validate(JSON.parse(output2), schema), 'valid schema')
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
  const result = stringify({
    foo: { foo: 'baz' }
  })

  t.equal(result, '{"foo":{"foo":"bar"}}')
  t.ok(validate(JSON.parse(result), schema), 'valid schema')
})
