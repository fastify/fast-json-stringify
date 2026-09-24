'use strict'

// V8 has to optimize the generated serializers and keep them optimized when they see again the
// values they were optimized for. To see why a case fails: node --trace-deopt test/deopt.test.js

const { test } = require('node:test')
const v8 = require('node:v8')

// before the library loads, so its functions collect feedback from the first call
v8.setFlagsFromString('--allow-natives-syntax')
v8.setFlagsFromString('--no-lazy-feedback-allocation')

const build = require('..')

/* eslint no-new-func: "off" */
const prepare = new Function('fn', '%PrepareFunctionForOptimization(fn)')
const optimize = new Function('fn', '%OptimizeFunctionOnNextCall(fn)')
const isOptimized = new Function('fn', 'return %ActiveTierIsTurbofan(fn)')

function assertStaysOptimized (t, stringify, inputs) {
  prepare(stringify)
  for (const input of inputs) stringify(input)
  optimize(stringify)
  stringify(inputs[0])
  t.assert.ok(isOptimized(stringify), 'V8 did not optimize it')

  for (let round = 0; round < 100; round++) {
    for (let i = 0; i < inputs.length; i++) {
      stringify(inputs[i])
      if (!isOptimized(stringify)) t.assert.fail(`deoptimized by input ${i} in round ${round}`)
    }
  }
}

test('string', (t) => {
  assertStaysOptimized(t, build({ type: 'string' }), [
    'hello', 'say "hi"', 'π', '😀', 'line\nbreak', '',
    'x'.repeat(100), 'y"'.repeat(50), 'z'.repeat(6000), null, new Date(0), /re/, 42
  ])
})

test('string formats', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      dateTime: { type: 'string', format: 'date-time' },
      date: { type: 'string', format: 'date' },
      time: { type: 'string', format: 'time' },
      unsafe: { type: 'string', format: 'unsafe' }
    }
  })
  assertStaysOptimized(t, stringify, [
    { dateTime: new Date(0), date: new Date(0), time: new Date(0), unsafe: 'raw' },
    { dateTime: '2020-01-01T00:00:00.000Z', date: '2020-01-01', time: '10:00:00', unsafe: 'raw' },
    { dateTime: null, date: null, time: null }
  ])
})

test('number', (t) => {
  assertStaysOptimized(t, build({ type: 'number' }), [42, -1.5, 1e21, Infinity, '42'])
})

test('integer', (t) => {
  assertStaysOptimized(t, build({ type: 'integer' }), [42, -42, 4.7, 2 ** 40, 10n])
})

test('integer with rounding', (t) => {
  assertStaysOptimized(t, build({ type: 'integer' }, { rounding: 'round' }), [42, 4.7, -4.2])
})

test('boolean', (t) => {
  assertStaysOptimized(t, build({ type: 'boolean' }), [true, false, 0, 'yes'])
})

test('object', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      score: { type: 'number' },
      active: { type: 'boolean' },
      role: { type: 'string', default: 'user' },
      note: { type: 'string', nullable: true },
      address: {
        type: 'object',
        properties: { city: { type: 'string' }, zip: { type: 'integer' } }
      }
    },
    required: ['id', 'name']
  })
  assertStaysOptimized(t, stringify, [
    { id: 1, name: 'a', score: 1.5, active: true, role: 'admin', note: 'n', address: { city: 'c', zip: 1 } },
    { id: 2, name: 'b', score: 2, note: null, address: null },
    { id: 3, name: 'c' }
  ])
})

test('array', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      numbers: { type: 'array', items: { type: 'number' } },
      strings: { type: 'array', items: { type: 'string' } },
      objects: {
        type: 'array',
        items: { type: 'object', properties: { s: { type: 'string' }, n: { type: 'number' } } }
      },
      tuple: { type: 'array', items: [{ type: 'string' }, { type: 'integer' }] },
      open: { type: 'array', items: [{ type: 'string' }], additionalItems: true }
    }
  })
  assertStaysOptimized(t, stringify, [
    {
      numbers: [1, 2.5],
      strings: ['a', 'b"'],
      objects: [{ s: 'a', n: 1 }, { s: 'b', n: 2.5 }],
      tuple: ['a', 1],
      open: ['a', 1, true]
    },
    { numbers: [], strings: [], objects: [], tuple: ['a'], open: [] }
  ])
})

test('large array mechanism', (t) => {
  const stringify = build(
    { type: 'array', items: { type: 'integer' } },
    { largeArrayMechanism: 'json-stringify', largeArraySize: 3 }
  )
  assertStaysOptimized(t, stringify, [[1, 2], [1, 2, 3, 4]])
})

test('additionalProperties and patternProperties', (t) => {
  const stringify = build({
    type: 'object',
    properties: { a: { type: 'string' } },
    patternProperties: { '^n': { type: 'number' } },
    additionalProperties: { type: 'string' }
  })
  assertStaysOptimized(t, stringify, [{ a: 'x', n1: 1, n2: 2.5, other: 'y' }, { other: 'y' }])
})

test('additionalProperties true', (t) => {
  const stringify = build({ type: 'object', additionalProperties: true })
  assertStaysOptimized(t, stringify, [{ a: 'x', b: 1, c: [1, { d: null }] }, {}])
})

test('multiple types', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      value: { type: ['string', 'integer', 'null'] },
      list: { type: ['array', 'object'], items: { type: 'integer' }, properties: { a: { type: 'integer' } } }
    }
  })
  assertStaysOptimized(t, stringify, [
    { value: 'a', list: [1, 2] },
    { value: 1, list: { a: 1 } },
    { value: null }
  ])
})

test('anyOf and oneOf', (t) => {
  const stringify = build({
    type: 'object',
    properties: {
      any: { anyOf: [{ type: 'string' }, { type: 'number' }] },
      one: {
        oneOf: [
          { type: 'object', properties: { kind: { const: 'a' }, a: { type: 'string' } }, required: ['kind'] },
          { type: 'object', properties: { kind: { const: 'b' }, b: { type: 'number' } }, required: ['kind'] }
        ]
      }
    }
  })
  assertStaysOptimized(t, stringify, [
    { any: 'x', one: { kind: 'a', a: 'x' } },
    { any: 1, one: { kind: 'b', b: 1 } }
  ])
})

test('if then else', (t) => {
  const stringify = build({
    type: 'object',
    properties: { kind: { type: 'string' } },
    if: { type: 'object', properties: { kind: { const: 'a' } } },
    then: { properties: { a: { type: 'string' } } },
    else: { properties: { b: { type: 'number' } } }
  })
  assertStaysOptimized(t, stringify, [{ kind: 'a', a: 'x' }, { kind: 'b', b: 1 }])
})

test('allOf', (t) => {
  const stringify = build({
    allOf: [
      { type: 'object', properties: { a: { type: 'string' } } },
      { properties: { b: { type: 'number' } } }
    ]
  })
  assertStaysOptimized(t, stringify, [{ a: 'x', b: 1 }, {}])
})

test('recursive ref', (t) => {
  const stringify = build({
    $id: 'tree',
    type: 'object',
    properties: {
      value: { type: 'integer' },
      children: { type: 'array', items: { $ref: 'tree#' } }
    }
  })
  assertStaysOptimized(t, stringify, [
    { value: 1, children: [{ value: 2, children: [] }, { value: 3, children: [{ value: 4 }] }] },
    { value: 5 }
  ])
})

test('external ref', (t) => {
  const defs = {
    $id: 'defs',
    definitions: { item: { type: 'object', properties: { x: { type: 'string' } } } }
  }
  const stringify = build(
    { type: 'object', properties: { item: { $ref: 'defs#/definitions/item' } } },
    { schema: { defs } }
  )
  assertStaysOptimized(t, stringify, [{ item: { x: 'y' } }, {}])
})

test('toJSON', (t) => {
  const stringify = build({ type: 'object', properties: { a: { type: 'string' } } })
  assertStaysOptimized(t, stringify, [{ a: 'x' }, { toJSON () { return { a: 'y' } } }])
})

// V8 does not optimize a function over a size, so a serializer whose code grows too much with
// every property stops being optimized for a wide object like this one
test('wide object', (t) => {
  const properties = {}
  const input = {}
  for (let i = 0; i < 300; i++) {
    switch (i % 4) {
      case 0: properties[`s${i}`] = { type: 'string' }; input[`s${i}`] = 'x'; break
      case 1: properties[`n${i}`] = { type: 'number' }; input[`n${i}`] = i; break
      case 2: properties[`b${i}`] = { type: 'boolean' }; input[`b${i}`] = true; break
      case 3:
        properties[`o${i}`] = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'integer' } } }
        input[`o${i}`] = { a: 'y', b: i }
    }
  }
  assertStaysOptimized(t, build({ type: 'object', properties }), [input, {}])
})
