'use strict'

const { test } = require('node:test')

// objectMechanism: 'native' depends on the runtime and on the schema:
//   - Node 25+ (V8 13.8+, JSON.stringify fast path): every projectable schema;
//   - Node 22 and 24: only the schemas where at least half of the values are
//     strings;
//   - older runtimes: never.
const build = require('..')

const nodeMajor = Number.parseInt(process.versions.node, 10)
const { HAS_FAST_JSON_STRINGIFY: hasFastPath } = require('../lib/v8')

const S = { type: 'string' }
const numeric = { type: 'object', properties: { a: S, n: { type: 'number' }, i: { type: 'integer' }, b: { type: 'boolean' } } } // 1 of 4
const stringHeavy = { type: 'object', properties: { a: S, b: S, n: { type: 'number' } } } // 2 of 3
const half = { type: 'object', properties: { a: S, n: { type: 'number' } } } // 1 of 2: half is enough
const nested = { // 4 of 5, with a ['string', 'null'] and the items of an array
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: S,
    tags: { type: 'array', items: S },
    address: { type: 'object', properties: { city: S, zip: { type: ['string', 'null'] } } }
  }
}
const nullableNumbers = { type: 'object', properties: { a: S, n: { type: ['number', 'null'] }, b: { type: ['boolean', 'null'] } } } // 1 of 3
const list = { type: 'array', items: stringHeavy }
const numericList = { type: 'array', items: numeric }
// the values behind a $ref count as if they were written in place: 3 of 4 and 1 of 4
const shared = { type: 'object', properties: { a: S, b: S } }
const refToStrings = { type: 'object', definitions: { shared }, properties: { n: { type: 'number' }, s: S, p: { $ref: '#/definitions/shared' } } }
const refToNumbers = { type: 'object', definitions: { numeric }, properties: { p: { $ref: '#/definitions/numeric' } } }
const notProjectable = { type: 'object', properties: { a: S, b: { anyOf: [S, { type: 'number' }] } } }

const schemas = { numeric, stringHeavy, half, nested, nullableNumbers, list, numericList, refToStrings, refToNumbers, notProjectable }
// what each tier projects
const always = { numeric: true, stringHeavy: true, half: true, nested: true, nullableNumbers: true, list: true, numericList: true, refToStrings: true, refToNumbers: true, notProjectable: false }
const onlyStringHeavy = { numeric: false, stringHeavy: true, half: true, nested: true, nullableNumbers: false, list: true, numericList: false, refToStrings: true, refToNumbers: false, notProjectable: false }
const never = { numeric: false, stringHeavy: false, half: false, nested: false, nullableNumbers: false, list: false, numericList: false, refToStrings: false, refToNumbers: false, notProjectable: false }

function projected (options) {
  const result = {}
  for (const name of Object.keys(schemas)) {
    result[name] = build(schemas[name], { objectMechanism: 'native', mode: 'debug', ...options }).code.includes('asStringValue')
  }
  return result
}

test('native mechanism: which schemas are projected on this runtime', t => {
  t.plan(1)
  t.assert.deepStrictEqual(projected(), hasFastPath ? always : nodeMajor >= 22 ? onlyStringHeavy : never)
})

test('native mechanism: each tier can be forced on every runtime', t => {
  t.plan(3)
  t.assert.deepStrictEqual(projected({ forceProjection: true }), always)
  t.assert.deepStrictEqual(projected({ forceProjection: 'string-heavy' }), onlyStringHeavy)
  // the default mechanism never projects
  t.assert.deepStrictEqual(projected({ objectMechanism: 'default', forceProjection: true }), never)
})

test('native mechanism: whatever the tier, the output is the one of the default mechanism', t => {
  const inputs = {
    numeric: { a: 'x', n: 1.5, i: 2, b: true, extra: true },
    stringHeavy: { a: 'x', b: 'y', n: 1, extra: true },
    half: { a: 'x', n: 1 },
    nested: { id: 1, name: 'n', tags: ['a', 'b'], address: { city: 'c', zip: null }, extra: true },
    nullableNumbers: { a: 'x', n: null, b: false },
    list: [{ a: 'x', b: 'y', n: 1 }, { a: 'z', b: 'w', n: 2, extra: 1 }],
    numericList: [{ a: 'x', n: 1, i: 2, b: false }],
    refToStrings: { n: 1, s: 's', p: { a: 'x', b: 'y', extra: true } },
    refToNumbers: { p: { a: 'x', n: 1, i: 2, b: true } },
    notProjectable: { a: 'x', b: 5 }
  }
  const tiers = [{}, { forceProjection: true }, { forceProjection: 'string-heavy' }]
  t.plan(Object.keys(schemas).length * tiers.length)
  for (const name of Object.keys(schemas)) {
    const expected = build(schemas[name])(inputs[name])
    for (const tier of tiers) {
      t.assert.equal(build(schemas[name], { objectMechanism: 'native', ...tier })(inputs[name]), expected)
    }
  }
})
