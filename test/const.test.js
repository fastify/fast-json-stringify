'use strict'

const { describe } = require('node:test')
const { ok, equal } = require('node:assert')
const validator = require('is-my-json-valid')
const build = require('..')

describe('schema with const string', () => {
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

  equal(output, '{"foo":"bar"}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const string and different input', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: 'baz'
  })

  equal(output, '{"foo":"bar"}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const string and different type input', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: 1
  })

  equal(output, '{"foo":"bar"}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const string and no input', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: 'bar' }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({})

  equal(output, '{}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const string that contains \'', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: "'bar'" }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: "'bar'"
  })

  equal(output, '{"foo":"\'bar\'"}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const number', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: 1
  })

  equal(output, '{"foo":1}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const number and different input', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: 2
  })

  equal(output, '{"foo":1}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const bool', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: true }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: true
  })

  equal(output, '{"foo":true}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const number', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: 1 }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: 1
  })

  equal(output, '{"foo":1}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const null', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: null }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: null
  })

  equal(output, '{"foo":null}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const array', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: [1, 2, 3] }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: [1, 2, 3]
  })

  equal(output, '{"foo":[1,2,3]}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const object', () => {
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

  equal(output, '{"foo":{"bar":"baz"}}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('schema with const and null as type', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { type: ['string', 'null'], const: 'baz' }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: null
  })

  equal(output, '{"foo":null}')
  ok(validate(JSON.parse(output)), 'valid schema')

  const output2 = stringify({ foo: 'baz' })
  equal(output2, '{"foo":"baz"}')
  ok(validate(JSON.parse(output2)), 'valid schema')
})

describe('schema with const as nullable', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { nullable: true, const: 'baz' }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    foo: null
  })

  equal(output, '{"foo":null}')
  ok(validate(JSON.parse(output)), 'valid schema')

  const output2 = stringify({
    foo: 'baz'
  })
  equal(output2, '{"foo":"baz"}')
  ok(validate(JSON.parse(output2)), 'valid schema')
})

describe('schema with const and invalid object', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: { const: { foo: 'bar' } }
    },
    required: ['foo']
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const result = stringify({
    foo: { foo: 'baz' }
  })

  equal(result, '{"foo":{"foo":"bar"}}')
  ok(validate(JSON.parse(result)), 'valid schema')
})
