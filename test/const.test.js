'use strict'

const test = require('tap').test
const ajv = new (require('ajv'))()
const build = require('..')

test('schema with const string', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const input = { foo: 'bar' }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{"foo":"bar"}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const string and different input', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { type: 'string', const: 'bar' }
    }
  }

  const input = { foo: 'baz' }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.throws(() => stringify(input), new Error("The value of '#/properties/foo' does not match schema definition."))
  t.not(validate(input))
})

test('schema with const string and different type input', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const input = { foo: 1 }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.throws(() => stringify(input), new Error("The value of '#/properties/foo' does not match schema definition."))
  t.not(validate(input))
})

test('schema with const string and no input', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const input = {}
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const number', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const input = { foo: 1 }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{"foo":1}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const number and different input', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const input = { foo: 2 }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.throws(() => stringify(input), new Error("The value of '#/properties/foo' does not match schema definition."))
  t.not(validate(input))
})

test('schema with const bool', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: true }
    }
  }

  const input = { foo: true }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{"foo":true}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const number', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const input = { foo: 1 }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{"foo":1}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const null', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: null }
    }
  }

  const input = { foo: null }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{"foo":null}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const array', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: [1, 2, 3] }
    }
  }

  const input = { foo: [1, 2, 3] }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{"foo":[1,2,3]}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const object', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      foo: { const: { bar: 'baz' } }
    }
  }

  const input = { foo: { bar: 'baz' } }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.equal(stringify(input), '{"foo":{"bar":"baz"}}')
  t.ok(validate((input)))
  t.equal(stringify(input), JSON.stringify(input))
})

test('schema with const and null as type', (t) => {
  t.plan(5)

  const schema = {
    type: 'object',
    properties: {
      foo: { type: ['string', 'null'], const: 'baz' }
    }
  }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.throws(() => stringify({ foo: null }), new Error("The value of '#/properties/foo' does not match schema definition."))
  t.not(validate({ foo: null }))

  t.equal(stringify({ foo: 'baz' }), '{"foo":"baz"}')
  t.ok(validate({ foo: 'baz' }))
  t.equal(stringify({ foo: 'baz' }), JSON.stringify({ foo: 'baz' }))
})

test('schema with const as nullable', (t) => {
  t.plan(5)

  const schema = {
    type: 'object',
    properties: {
      foo: { type: 'string', nullable: true, const: 'baz' }
    }
  }

  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.throws(() => stringify({ foo: null }), new Error("The value of '#/properties/foo' does not match schema definition."))
  t.not(validate({ foo: null }))

  t.equal(stringify({ foo: 'baz' }), '{"foo":"baz"}')
  t.ok(validate({ foo: 'baz' }))
  t.equal(stringify({ foo: 'baz' }), JSON.stringify({ foo: 'baz' }))
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

  const input = { foo: { foo: 'baz' } }
  const validate = ajv.compile(schema)
  const stringify = build(schema)

  t.throws(() => stringify(input), new Error("The value of '#/properties/foo' does not match schema definition."))
  t.not(validate(input))
})
