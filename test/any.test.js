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
