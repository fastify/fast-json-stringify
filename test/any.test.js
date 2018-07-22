'use strict'

const test = require('tap').test
const build = require('..')

test('object with nested random property', (t) => {
  t.plan(4)

  const schema = {
    title: 'empty schema to allow any object',
    type: 'object',
    properties: {
      id: {
        type: 'number'
      },
      name: {}
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      id: 1,
      name: 'string'
    })
    t.is(value, '{"id":1,"name":"string"}')
  } catch (e) {
    t.fail()
  }
  try {
    const value = stringify({
      id: 1,
      name: {
        first: 'name',
        last: 'last'
      }
    })
    t.is(value, '{"id":1,"name":{"first":"name","last":"last"}}')
  } catch (e) {
    t.fail()
  }
  try {
    const value = stringify({
      id: 1,
      name: null
    })
    t.is(value, '{"id":1,"name":null}')
  } catch (e) {
    t.fail()
  }
  try {
    const value = stringify({
      id: 1,
      name: ['first', 'last']
    })
    t.is(value, '{"id":1,"name":["first","last"]}')
  } catch (e) {
    t.fail()
  }
})

test('array with random items', (t) => {
  t.plan(1)

  const schema = {
    title: 'empty schema to allow any object',
    type: 'array',
    items: {
    }
  }
  const stringify = build(schema)

  try {
    const value = stringify([1, 'string', null])
    t.is(value, '[1,"string",null]')
  } catch (e) {
    t.fail()
  }
})
