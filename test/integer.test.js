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
