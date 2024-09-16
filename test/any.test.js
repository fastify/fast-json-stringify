'use strict'

const { describe } = require('node:test')
const { deepStrictEqual, throws } = require('node:assert')
const build = require('..')

describe('object with nested random property', () => {
  const schema = {
    title: 'empty schema to allow any object',
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: {}
    }
  }
  const stringify = build(schema)

  deepStrictEqual(stringify({
    id: 1, name: 'string'
  }), '{"id":1,"name":"string"}')

  deepStrictEqual(stringify({
    id: 1, name: { first: 'name', last: 'last' }
  }), '{"id":1,"name":{"first":"name","last":"last"}}')

  deepStrictEqual(stringify({
    id: 1, name: null
  }), '{"id":1,"name":null}')

  deepStrictEqual(stringify({
    id: 1, name: ['first', 'last']
  }), '{"id":1,"name":["first","last"]}')
})

// reference: https://github.com/fastify/fast-json-stringify/issues/259
describe('object with empty schema with $id: undefined set', () => {
  const schema = {
    title: 'empty schema to allow any object with $id: undefined set',
    type: 'object',
    properties: {
      name: { $id: undefined }
    }
  }
  const stringify = build(schema)
  deepStrictEqual(stringify({
    name: 'string'
  }), '{"name":"string"}')
})

describe('array with random items', () => {
  const schema = {
    title: 'empty schema to allow any object',
    type: 'array',
    items: {}
  }
  const stringify = build(schema)

  const value = stringify([1, 'string', null])
  deepStrictEqual(value, '[1,"string",null]')
})

describe('empty schema', () => {
  const schema = { }

  const stringify = build(schema)

  deepStrictEqual(stringify(null), 'null')
  deepStrictEqual(stringify(1), '1')
  deepStrictEqual(stringify(true), 'true')
  deepStrictEqual(stringify('hello'), '"hello"')
  deepStrictEqual(stringify({}), '{}')
  deepStrictEqual(stringify({ x: 10 }), '{"x":10}')
  deepStrictEqual(stringify([true, 1, 'hello']), '[true,1,"hello"]')
})

describe('empty schema on nested object', () => {
  const schema = {
    type: 'object',
    properties: {
      x: {}
    }
  }

  const stringify = build(schema)

  deepStrictEqual(stringify({ x: null }), '{"x":null}')
  deepStrictEqual(stringify({ x: 1 }), '{"x":1}')
  deepStrictEqual(stringify({ x: true }), '{"x":true}')
  deepStrictEqual(stringify({ x: 'hello' }), '{"x":"hello"}')
  deepStrictEqual(stringify({ x: {} }), '{"x":{}}')
  deepStrictEqual(stringify({ x: { x: 10 } }), '{"x":{"x":10}}')
  deepStrictEqual(stringify({ x: [true, 1, 'hello'] }), '{"x":[true,1,"hello"]}')
})

describe('empty schema on array', () => {
  const schema = {
    type: 'array',
    items: {}
  }

  const stringify = build(schema)

  deepStrictEqual(stringify([1, true, 'hello', [], { x: 1 }]), '[1,true,"hello",[],{"x":1}]')
})

describe('empty schema on anyOf', () => {
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

  deepStrictEqual(stringify({ kind: 'Bar', value: 1 }), '{"kind":"Bar","value":1}')
  deepStrictEqual(stringify({ kind: 'Foo', value: 1 }), '{"kind":"Foo","value":1}')
  deepStrictEqual(stringify({ kind: 'Foo', value: true }), '{"kind":"Foo","value":true}')
  deepStrictEqual(stringify({ kind: 'Foo', value: 'hello' }), '{"kind":"Foo","value":"hello"}')
})

describe('should throw a TypeError with the path to the key of the invalid value /1', () => {
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

  throws(() => stringify({ kind: 'Baz', value: 1 }), new TypeError('The value of \'#\' does not match schema definition.'))
})

describe('should throw a TypeError with the path to the key of the invalid value /2', () => {
  // any on Foo codepath.
  const schema = {
    type: 'object',
    properties: {
      data: {
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
    }
  }

  const stringify = build(schema)

  throws(() => stringify({ data: { kind: 'Baz', value: 1 } }), new TypeError('The value of \'#/properties/data\' does not match schema definition.'))
})
