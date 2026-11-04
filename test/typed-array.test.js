'use strict'

const { test } = require('node:test')
const build = require('..')

function expectedArrayJson (typedArray) {
  return JSON.stringify(Array.from(typedArray))
}

test('serializes Float32Array as a JSON array of numbers', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'number' }
  })

  const input = new Float32Array([0.1, 0.2, 0.3])
  t.assert.equal(stringify(input), expectedArrayJson(input))
})

test('serializes Float64Array as a JSON array of numbers', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'number' }
  })

  const input = new Float64Array([1.5, -2.25, 3])
  t.assert.equal(stringify(input), expectedArrayJson(input))
})

test('serializes Int32Array as a JSON array of integers', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'integer' }
  })

  const input = new Int32Array([-1, 0, 42])
  t.assert.equal(stringify(input), expectedArrayJson(input))
})

test('serializes Uint8Array as a JSON array of integers', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'integer' }
  })

  const input = new Uint8Array([0, 127, 255])
  t.assert.equal(stringify(input), expectedArrayJson(input))
})

test('serializes TypedArray nested under an object property', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      samples: {
        type: 'array',
        items: { type: 'number' }
      }
    }
  })

  const samples = new Float32Array([1, 2, 3])
  t.assert.equal(
    stringify({ samples }),
    `{"samples":${expectedArrayJson(samples)}}`
  )
})

test('empty TypedArray serializes to []', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'number' }
  })

  t.assert.equal(stringify(new Float32Array(0)), '[]')
})

test('DataView is still rejected for type array', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'number' }
  })

  t.assert.throws(
    () => stringify(new DataView(new ArrayBuffer(8))),
    TypeError
  )
})

test('largeArrayMechanism json-stringify still emits a JSON array for TypedArrays', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'number' }
  }, {
    largeArrayMechanism: 'json-stringify',
    largeArraySize: 2
  })

  // Native JSON.stringify(Float32Array) would be {"0":…}; FJS must not use that.
  const input = new Float32Array([1, 2, 3, 4])
  t.assert.equal(stringify(input), expectedArrayJson(input))
})

test('multi-type [object, array] prefers array for TypedArray input', (t) => {
  t.plan(1)

  const stringify = build({
    type: ['object', 'array'],
    properties: {
      a: { type: 'integer' }
    },
    items: { type: 'integer' }
  }, { ajv: { allowUnionTypes: true } })

  const input = new Int32Array([1, 2, 3])
  t.assert.equal(stringify(input), expectedArrayJson(input))
})

test('issue #626 example: Float32Array of many numbers', (t) => {
  t.plan(2)

  const stringify = build({
    title: 'Example Schema',
    type: 'array',
    items: {
      type: 'number'
    }
  })

  const array = new Float32Array(new Array(4000).fill(1))
  const output = stringify(array)
  t.assert.equal(output, expectedArrayJson(array))
  t.assert.ok(output.startsWith('[') && output.endsWith(']'))
})
