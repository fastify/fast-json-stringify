'use strict'

const { test } = require('node:test')
const { throws, equal, ok } = require('node:assert')
const validator = require('is-my-json-valid')
const build = require('..')
const ROUNDING_TYPES = ['ceil', 'floor', 'round']

test('render an integer as JSON', () => {
  const schema = {
    title: 'integer',
    type: 'integer'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(1615)

  equal(output, '1615')
  ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a float as an integer', () => {
  try {
    build({
      title: 'float as integer',
      type: 'integer'
    }, { rounding: 'foobar' })
  } catch (error) {
    ok(error)
    equal(error.message, 'Unsupported integer rounding method foobar')
  }
})

test('throws on NaN', () => {
  const schema = {
    title: 'integer',
    type: 'integer'
  }

  const stringify = build(schema)
  throws(() => stringify(NaN), new Error('The value "NaN" cannot be converted to an integer.'))
})

test('render a float as an integer', () => {
  const cases = [
    { input: Math.PI, output: '3' },
    { input: 5.0, output: '5' },
    { input: null, output: '0' },
    { input: 0, output: '0' },
    { input: 0.0, output: '0' },
    { input: 42, output: '42' },
    { input: 1.99999, output: '1' },
    { input: -45.05, output: '-45' },
    { input: 3333333333333333, output: '3333333333333333' },
    { input: Math.PI, output: '3', rounding: 'trunc' },
    { input: 5.0, output: '5', rounding: 'trunc' },
    { input: null, output: '0', rounding: 'trunc' },
    { input: 0, output: '0', rounding: 'trunc' },
    { input: 0.0, output: '0', rounding: 'trunc' },
    { input: 42, output: '42', rounding: 'trunc' },
    { input: 1.99999, output: '1', rounding: 'trunc' },
    { input: -45.05, output: '-45', rounding: 'trunc' },
    { input: 0.95, output: '1', rounding: 'ceil' },
    { input: 0.2, output: '1', rounding: 'ceil' },
    { input: 45.95, output: '45', rounding: 'floor' },
    { input: -45.05, output: '-46', rounding: 'floor' },
    { input: 45.44, output: '45', rounding: 'round' },
    { input: 45.95, output: '46', rounding: 'round' }
  ]

  cases.forEach(checkInteger)

  function checkInteger ({ input, output, rounding }) {
    const schema = {
      title: 'float as integer',
      type: 'integer'
    }

    const validate = validator(schema)
    const stringify = build(schema, { rounding })
    const str = stringify(input)

    equal(str, output)
    ok(validate(JSON.parse(str)), 'valid schema')
  }
})

test('render an object with an integer as JSON', () => {
  const schema = {
    title: 'object with integer',
    type: 'object',
    properties: {
      id: {
        type: 'integer'
      }
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    id: 1615
  })

  equal(output, '{"id":1615}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

test('render an array with an integer as JSON', () => {
  const schema = {
    title: 'array with integer',
    type: 'array',
    items: {
      type: 'integer'
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify([1615])

  equal(output, '[1615]')
  ok(validate(JSON.parse(output)), 'valid schema')
})

test('render an object with an additionalProperty of type integer as JSON', () => {
  const schema = {
    title: 'object with integer',
    type: 'object',
    additionalProperties: {
      type: 'integer'
    }
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({
    num: 1615
  })

  equal(output, '{"num":1615}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

test('should round integer object parameter', t => {
  const schema = { type: 'object', properties: { magic: { type: 'integer' } } }
  const validate = validator(schema)
  const stringify = build(schema, { rounding: 'ceil' })
  const output = stringify({ magic: 4.2 })

  equal(output, '{"magic":5}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

test('should not stringify a property if it does not exist', t => {
  const schema = { title: 'Example Schema', type: 'object', properties: { age: { type: 'integer' } } }
  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify({})

  equal(output, '{}')
  ok(validate(JSON.parse(output)), 'valid schema')
})

ROUNDING_TYPES.forEach((rounding) => {
  test(`should not stringify a property if it does not exist (rounding: ${rounding})`, t => {
    const schema = { type: 'object', properties: { magic: { type: 'integer' } } }
    const validate = validator(schema)
    const stringify = build(schema, { rounding })
    const output = stringify({})

    equal(output, '{}')
    ok(validate(JSON.parse(output)), 'valid schema')
  })
})
