'use strict'

const { test } = require('node:test')
const build = require('..')

test('json-stringify mechanism diverges from default on null in non-nullable integer array', (t) => {
  t.plan(2)
  const schema = { type: 'array', items: { type: 'integer' } }
  const def = build(schema, { largeArrayMechanism: 'default' })
  const js = build(schema, { largeArrayMechanism: 'json-stringify', largeArraySize: 1 })
  t.assert.equal(def([1, null, 2]), '[1,0,2]')
  t.assert.equal(js([1, null, 2]), '[1,null,2]')
})

test('json-stringify mechanism diverges from default on extra object properties', (t) => {
  t.plan(2)
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        a: { type: 'integer' },
        b: { type: 'string' }
      },
      additionalProperties: false
    }
  }
  const def = build(schema, { largeArrayMechanism: 'default' })
  const js = build(schema, { largeArrayMechanism: 'json-stringify', largeArraySize: 1 })
  const input = [{ a: 1, b: 'x', extra: 'y' }]
  t.assert.equal(def(input), '[{"a":1,"b":"x"}]')
  t.assert.equal(js(input), '[{"a":1,"b":"x","extra":"y"}]')
})

test('json-stringify mechanism follows insertion order; default follows schema property order', (t) => {
  t.plan(2)
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        a: { type: 'integer' },
        b: { type: 'string' }
      },
      required: ['a', 'b']
    }
  }
  const def = build(schema, { largeArrayMechanism: 'default' })
  const js = build(schema, { largeArrayMechanism: 'json-stringify', largeArraySize: 1 })
  const input = [{ b: 'x', a: 1 }]
  t.assert.equal(def(input), '[{"a":1,"b":"x"}]')
  t.assert.equal(js(input), '[{"b":"x","a":1}]')
})

test('typed arrays are not accepted as array inputs', (t) => {
  t.plan(4)
  const stringify = build({ type: 'array', items: { type: 'number' } })
  t.assert.equal(Array.isArray(new Float64Array([1, 2, 3])), false)
  t.assert.equal(Array.isArray(new Int32Array([1, 2, 3])), false)
  t.assert.throws(() => stringify(new Float64Array([1, 2, 3])), TypeError)
  t.assert.throws(() => stringify(new Int32Array([1, 2, 3])), TypeError)
})
