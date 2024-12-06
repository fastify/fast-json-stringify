'use strict'

const test = require('tap').test
const build = require('..')

test('throw on unknown keyword with strictSchema: true', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      a: { type: 'string' }
    },
    anUnknownKeyword: true
  }

  t.throws(() => {
    build(schema, { ajv: { strictSchema: true } })
  }, new Error('strict mode: unknown keyword: "anUnknownKeyword"'))
})

test('throw on unknown keyword in a referenced schema with strictSchema: true', (t) => {
  t.plan(1)

  const referencedSchemas = {
    foo: {
      properties: {
        b: { type: 'string' }
      },
      anUnknownKeyword: true
    }
  }

  const schema = {
    type: 'object',
    properties: {
      a: { type: 'object', $ref: 'foo' }
    }
  }

  t.throws(() => {
    build(schema, { schema: referencedSchemas, ajv: { strictSchema: true } })
  }, new Error('strict mode: unknown keyword: "anUnknownKeyword"'))
})
