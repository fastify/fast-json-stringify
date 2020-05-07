'use strict'

const t = require('tap')
const test = t.test
const proxyquire = require('proxyquire')
const build = proxyquire('..', { long: null })

test('render Infinity as null (integer)', (t) => {
  t.plan(1)

  const schema = {
    title: 'integer',
    type: 'integer'
  }

  const stringify = build(schema)
  const output = stringify(Infinity)

  t.equal(output, 'null')
})
test('render Infinity as null (number)', (t) => {
  t.plan(1)

  const schema = {
    title: 'number',
    type: 'number'
  }

  const stringify = build(schema)
  const output = stringify(Infinity)

  t.equal(output, 'null')
})

test('render negative Infinity as null', (t) => {
  t.plan(1)

  const schema = {
    title: 'integer',
    type: 'integer'
  }

  const stringify = build(schema)
  const output = stringify(-Infinity)

  t.equal(output, 'null')
})
