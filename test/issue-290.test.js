'use strict'

const { test } = require('tap')
const build = require('..')

test('should work with anyOf', (t) => {
  t.plan(2)

  const schemaFoo = {
    properties: {
      foo: { type: 'string' },
      baz: { type: 'string' }
    },
    required: ['foo', 'baz']
  }

  const schemaBar = {
    properties: {
      bar: { type: 'string' },
      baz: { type: 'string' }
    },
    required: ['bar', 'baz']
  }

  const stringify = build({
    type: 'object',
    anyOf: [schemaFoo, schemaBar]
  })

  t.equal(stringify({ foo: 'foo', baz: 'baz' }), '{"foo":"foo","baz":"baz"}')
  t.equal(stringify({ bar: 'bar', baz: 'baz' }), '{"bar":"bar","baz":"baz"}')
})

test('should work with oneOf', (t) => {
  t.plan(2)

  const schemaFoo = {
    properties: {
      foo: { type: 'string' },
      baz: { type: 'string' }
    },
    required: ['foo', 'baz']
  }

  const schemaBar = {
    properties: {
      bar: { type: 'string' },
      baz: { type: 'string' }
    },
    required: ['bar', 'baz']
  }

  const stringify = build({
    type: 'object',
    oneOf: [schemaFoo, schemaBar]
  })

  t.equal(stringify({ foo: 'foo', baz: 'baz' }), '{"foo":"foo","baz":"baz"}')
  t.equal(stringify({ bar: 'bar', baz: 'baz' }), '{"bar":"bar","baz":"baz"}')
})

test('should merge schemas properly', (t) => {
  t.plan(1)

  const schema = {
    properties: {
      foo: { type: 'string' }
    },
    oneOf: [{ type: 'object' }]
  }

  const stringify = build(schema)

  t.equal(stringify({ foo: 'foo' }), '{"foo":"foo"}')
})
