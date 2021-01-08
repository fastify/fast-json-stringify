'use strict'

const test = require('tap').test
const build = require('..')

test('object with nested random property', (t) => {
  t.plan(4)

  const schema = {
    title: 'empty schema to allow any object',
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: {}
    }
  }
  const stringify = build(schema)

  t.is(stringify({
    id: 1, name: 'string'
  }), '{"id":1,"name":"string"}')

  t.is(stringify({
    id: 1, name: { first: 'name', last: 'last' }
  }), '{"id":1,"name":{"first":"name","last":"last"}}')

  t.is(stringify({
    id: 1, name: null
  }), '{"id":1,"name":null}')

  t.is(stringify({
    id: 1, name: ['first', 'last']
  }), '{"id":1,"name":["first","last"]}')
})

// reference: https://github.com/fastify/fast-json-stringify/issues/259
test('object with empty schema with $id: undefined set', (t) => {
  t.plan(1)

  const schema = {
    title: 'empty schema to allow any object with $id: undefined set',
    type: 'object',
    properties: {
      name: { $id: undefined }
    }
  }
  const stringify = build(schema)
  t.is(stringify({
    name: 'string'
  }), '{"name":"string"}')
})

test('array with random items', (t) => {
  t.plan(1)

  const schema = {
    title: 'empty schema to allow any object',
    type: 'array',
    items: {}
  }
  const stringify = build(schema)

  const value = stringify([1, 'string', null])
  t.is(value, '[1,"string",null]')
})

test('empty schema', (t) => {
  t.plan(7)

  const schema = { }

  const stringify = build(schema)

  t.is(stringify(null), 'null')
  t.is(stringify(1), '1')
  t.is(stringify(true), 'true')
  t.is(stringify('hello'), '"hello"')
  t.is(stringify({}), '{}')
  t.is(stringify({ x: 10 }), '{"x":10}')
  t.is(stringify([true, 1, 'hello']), '[true,1,"hello"]')
})

test('empty schema on nested object', (t) => {
  t.plan(7)

  const schema = {
    type: 'object',
    properties: {
      x: {}
    }
  }

  const stringify = build(schema)

  t.is(stringify({ x: null }), '{"x":null}')
  t.is(stringify({ x: 1 }), '{"x":1}')
  t.is(stringify({ x: true }), '{"x":true}')
  t.is(stringify({ x: 'hello' }), '{"x":"hello"}')
  t.is(stringify({ x: {} }), '{"x":{}}')
  t.is(stringify({ x: { x: 10 } }), '{"x":{"x":10}}')
  t.is(stringify({ x: [true, 1, 'hello'] }), '{"x":[true,1,"hello"]}')
})

test('empty schema on array', (t) => {
  t.plan(1)

  const schema = {
    type: 'array',
    items: {}
  }

  const stringify = build(schema)

  t.is(stringify([1, true, 'hello', [], { x: 1 }]), '[1,true,"hello",[],{"x":1}]')
})

test('empty schema on anyOf', (t) => {
  t.plan(4)

  // any on Foo codepath.
  const schema = {
    anyOf: [
      {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Foo']
          },
          value: {}
        }
      },
      {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['Bar']
          },
          value: {
            type: 'number'
          }
        }
      }
    ]
  }

  const stringify = build(schema)

  t.is(stringify({ kind: 'Bar', value: 1 }), '{"kind":"Bar","value":1}')
  t.is(stringify({ kind: 'Foo', value: 1 }), '{"kind":"Foo","value":1}')
  t.is(stringify({ kind: 'Foo', value: true }), '{"kind":"Foo","value":true}')
  t.is(stringify({ kind: 'Foo', value: 'hello' }), '{"kind":"Foo","value":"hello"}')
})
