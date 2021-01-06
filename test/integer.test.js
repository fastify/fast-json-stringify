'use strict'

const t = require('tap')
const test = t.test
const semver = require('semver')
const validator = require('is-my-json-valid')
const proxyquire = require('proxyquire')
const build = proxyquire('..', { long: null })

test('render an integer as JSON', (t) => {
  t.plan(2)

  const schema = {
    title: 'integer',
    type: 'integer'
  }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(1615)

  t.equal(output, '1615')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a float as an integer', (t) => {
  t.plan(2)
  try {
    build({
      title: 'float as integer',
      type: 'integer'
    }, { rounding: 'foobar' })
  } catch (error) {
    t.ok(error)
    t.equals(error.message, 'Unsupported integer rounding method foobar')
  }
})

test('render a float as an integer', (t) => {
  const cases = [
    { input: Math.PI, output: '3' },
    { input: 5.0, output: '5' },
    { input: 1.99999, output: '1' },
    { input: -45.05, output: '-45' },
    { input: 0.95, output: '1', rounding: 'ceil' },
    { input: 0.2, output: '1', rounding: 'ceil' },
    { input: 45.95, output: '45', rounding: 'floor' },
    { input: -45.05, output: '-46', rounding: 'floor' },
    { input: 45.44, output: '45', rounding: 'round' },
    { input: 45.95, output: '46', rounding: 'round' }
  ]

  t.plan(cases.length * 2)
  cases.forEach(checkInteger)

  function checkInteger ({ input, output, rounding }) {
    const schema = {
      title: 'float as integer',
      type: 'integer'
    }

    const validate = validator(schema)
    const stringify = build(schema, { rounding })
    const str = stringify(input)

    t.equal(str, output)
    t.ok(validate(JSON.parse(str)), 'valid schema')
  }
})

test('render an object with an integer as JSON', (t) => {
  t.plan(2)

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

  t.equal(output, '{"id":1615}')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render an array with an integer as JSON', (t) => {
  t.plan(2)

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

  t.equal(output, '[1615]')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render an object with an additionalProperty of type integer as JSON', (t) => {
  t.plan(2)

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

  t.equal(output, '{"num":1615}')
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

if (semver.gt(process.versions.node, '10.3.0')) {
  require('./bigint')(t.test, build)
} else {
  t.pass('Skip because Node version < 10.4')
  t.end()
}
