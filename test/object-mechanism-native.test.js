'use strict'

// The projection is only enabled on Node 25+ (V8 13.8+). Force it here so the
// semantics are tested on every runtime in CI; the gate itself is tested in
// object-mechanism-gate.test.js.
const { test } = require('node:test')
const fjs = require('..')
const build = (schema, options) => fjs(schema, options && options.objectMechanism === 'native' ? { ...options, forceProjection: true } : options)

// objectMechanism: 'native' must be byte-identical to the default codegen on
// every projectable schema (same output, or same error), and must fall back to
// the default codegen on every schema it does not cover.

const userSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string', default: 'none@example.com' },
    active: { type: 'boolean' },
    score: { type: 'number' },
    createdAt: { type: 'string', format: 'date-time' },
    birthday: { type: 'string', format: 'date' },
    at: { type: 'string', format: 'time' },
    tags: { type: 'array', items: { type: 'string' } },
    scores: { type: 'array', items: { type: 'number' } },
    address: {
      type: 'object',
      required: ['city'],
      properties: { street: { type: 'string' }, city: { type: 'string' }, zip: { type: 'string' } }
    },
    friends: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } }
    }
  }
}

class User { constructor (o) { Object.assign(this, o) } }

const base = {
  id: 1,
  name: 'Mario "Il" Rossi\n\u0000',
  email: 'm@x.it',
  active: true,
  score: 42.5,
  createdAt: new Date(0),
  birthday: new Date(86400000),
  at: new Date(3600000),
  tags: ['a', 'b"c', 'd'],
  scores: [1, 2.5, -3],
  address: { street: 'Via Roma 1', city: 'Milano', zip: '20100' },
  friends: [{ id: 2, name: 'Luigi' }, { id: 3, name: 'Peach' }]
}

const inputs = {
  base,
  'extra properties are dropped': { ...base, secret: 'x', internal: { a: 1 } },
  'class instance': new User(base),
  'undefined optional is omitted': { ...base, name: undefined, address: undefined, friends: undefined },
  'missing optional, default applied': { id: 1 },
  nulls: { id: 1, name: null, email: null, active: null, score: null, createdAt: null, birthday: null, at: null, tags: null, scores: null, address: null, friends: null },
  'null inside arrays': { id: 1, tags: ['a', null, 'c'], scores: [1, null, 3], friends: [null, { id: 1 }] },
  coercions: { id: 1.7, name: 123, active: 'yes', score: '3.5', tags: [1, 2], scores: ['4', '5'] },
  'Date in a plain string': { id: 1, name: new Date(0), tags: [new Date(0)] },
  'RegExp in a plain string': { id: 1, name: /a"b/, tags: [/c/g] },
  'date-time given as string': { id: 1, createdAt: '2020-01-01T00:00:00.000Z' },
  'toJSON on root': { id: 1, toJSON () { return { id: 7, name: 'json' } } },
  'toJSON on nested object': { id: 1, address: { toJSON () { return { city: 'Roma' } } } },
  'toJSON on array item': { id: 1, friends: [{ toJSON () { return { id: 9 } } }] },
  'required missing on root throws': { name: 'no id' },
  'required missing on nested throws': { id: 1, address: { street: 'x' } },
  'NaN throws': { id: 1, score: NaN },
  'Infinity becomes null': { id: 1, score: Infinity },
  'bigint integer': { id: 10n },
  'object items with missing fields': { id: 1, friends: [{ id: 1 }, { name: 'x' }, {}] },
  'empty arrays': { id: 1, tags: [], scores: [], friends: [] },
  'input key order differs from schema': { friends: [], address: { zip: '1', city: 'c', street: 's' }, score: 1, id: 1 },
  'null root': null,
  'non-array where array expected throws': { id: 1, tags: 'abc' }
}

const run = (fn, v) => {
  try { return { ok: fn(v) } } catch (e) { return { err: `${e.constructor.name}: ${e.message}` } }
}

test('native mechanism is byte-identical to the default codegen', t => {
  const def = build(userSchema)
  const nat = build(userSchema, { objectMechanism: 'native' })
  t.plan(Object.keys(inputs).length)
  for (const [name, input] of Object.entries(inputs)) {
    t.assert.deepStrictEqual(run(nat, input), run(def, input), name)
  }
})

test('native mechanism: array root of objects', t => {
  const schema = { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'integer' }, name: { type: 'string' } } } }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })
  const data = [
    [],
    [{ id: 1, name: 'a' }, { id: 2 }, { id: 3, name: null, extra: true }],
    Array.from({ length: 50 }, (_, i) => ({ id: i, name: 'n' + i })),
    [{ name: 'missing id' }],
    null,
    'not an array'
  ]
  t.plan(data.length + 1)
  for (const d of data) t.assert.deepStrictEqual(run(nat, d), run(def, d))
  // pool grows and shrinks with the input length without leaking previous items
  t.assert.equal(nat([{ id: 1 }]), '[{"id":1}]')
})

test('native mechanism: array root of primitives', t => {
  t.plan(3)
  for (const items of [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }]) {
    const schema = { type: 'array', items }
    const d = ['a', 1, null, true, 2.5, 'b']
    t.assert.deepStrictEqual(run(build(schema, { objectMechanism: 'native' }), d), run(build(schema), d))
  }
})

test('native mechanism generates projection code only for projectable schemas', t => {
  const projectable = [
    userSchema,
    { type: 'object', properties: { a: { type: 'string' } } },
    { type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } },
    { type: 'object', properties: { a: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } },
    { type: 'object', properties: { a: { type: 'array', items: { type: 'object', properties: { b: { type: 'object', properties: { c: { type: 'string' } } } } } } } },
    { type: 'object', properties: { a: { type: ['string', 'null'] } } }
  ]
  const notProjectable = [
    { type: 'string' },
    { type: 'object', properties: {} },
    { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: true },
    { type: 'object', properties: { a: { type: 'string' } }, patternProperties: { '^x': { type: 'string' } } },
    { type: 'object', nullable: true, properties: { a: { type: 'string' } } },
    { type: 'object', properties: { a: { type: 'string', nullable: true } } },
    { type: 'object', properties: { a: { type: ['string', 'number'] } } },
    { type: 'object', properties: { a: { type: ['integer', 'null'] } } },
    { type: 'object', properties: { a: { const: 'x' } } },
    { type: 'object', properties: { a: { type: 'string', enum: ['x'] } } },
    { type: 'object', properties: { a: { anyOf: [{ type: 'string' }] } } },
    { type: 'object', properties: { a: { type: 'string', format: 'email' } } },
    { type: 'object', properties: { a: { $ref: '#/definitions/s' } }, definitions: { s: { type: 'string' } } },
    { type: 'object', properties: { a: { type: 'array', items: [{ type: 'string' }] } } },
    { type: 'object', properties: { a: { type: 'array' } } },
    { type: 'object', properties: { a: { type: 'null' } } }
  ]
  t.plan(projectable.length + notProjectable.length)
  for (const s of projectable) {
    t.assert.ok(build(s, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'), JSON.stringify(s))
  }
  for (const s of notProjectable) {
    t.assert.ok(!build(s, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'), JSON.stringify(s))
  }
})

test('native mechanism: unsupported schemas keep the default output', t => {
  const schema = {
    type: 'object',
    properties: { a: { type: 'string' }, b: { type: 'string', nullable: true } },
    additionalProperties: { type: 'number' }
  }
  const data = { a: 'x', b: null, c: 1, d: 2 }
  t.plan(1)
  t.assert.equal(build(schema, { objectMechanism: 'native' })(data), build(schema)(data))
})

test('objectMechanism option validation', t => {
  t.plan(3)
  t.assert.doesNotThrow(() => build({ type: 'object', properties: { a: { type: 'string' } } }, { objectMechanism: 'default' }))
  t.assert.doesNotThrow(() => build({ type: 'object', properties: { a: { type: 'string' } } }, { objectMechanism: 'native' }))
  t.assert.throws(() => build({ type: 'object', properties: { a: { type: 'string' } } }, { objectMechanism: 'turbo' }), /Unsupported object mechanism turbo/)
})

test('native mechanism: scratch does not leak state between calls', t => {
  const schema = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' }, nested: { type: 'object', properties: { c: { type: 'string' } } } } }
  const nat = build(schema, { objectMechanism: 'native' })
  t.plan(3)
  t.assert.equal(nat({ a: '1', b: '2', nested: { c: '3' } }), '{"a":"1","b":"2","nested":{"c":"3"}}')
  t.assert.equal(nat({ a: '1' }), '{"a":"1"}')
  t.assert.equal(nat({ nested: {} }), '{"nested":{}}')
})

test('native mechanism works in standalone mode', t => {
  const schema = { type: 'object', properties: { a: { type: 'string' }, n: { type: 'number' } } }
  const code = build(schema, { objectMechanism: 'native', mode: 'standalone' })
  const fs = require('node:fs'); const path = require('node:path')
  // written under test/fixtures like the other standalone tests, so that the
  // generated require('fast-json-stringify/...') resolves against this package
  const file = path.resolve('test/fixtures', 'standalone-native.js')
  fs.writeFileSync(file, code)
  t.after(() => fs.rmSync(file, { force: true }))
  const stringify = require(file)
  t.plan(2)
  t.assert.ok(code.includes('asStringValue'), 'projection code is emitted')
  t.assert.equal(stringify({ a: 'x', n: 1.5, extra: true }), '{"a":"x","n":1.5}')
})

test('native mechanism: required keys not declared in properties still throw', t => {
  const schema = { type: 'object', required: ['id', 'token'], properties: { id: { type: 'integer' } } }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })
  t.plan(2)
  t.assert.deepStrictEqual(run(nat, { id: 1 }), run(def, { id: 1 }))
  t.assert.deepStrictEqual(run(nat, { id: 1, token: 'x' }), run(def, { id: 1, token: 'x' }))
})

test('native mechanism: deeply nested schema beyond the projection depth falls back', t => {
  let schema = { type: 'string' }
  for (let i = 0; i < 40; i++) schema = { type: 'object', properties: { p: schema } }
  t.plan(1)
  t.assert.ok(!build(schema, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'))
})

test('native mechanism: [primitive, null] multi-type properties keep the strict dispatch', t => {
  const schema = {
    type: 'object',
    properties: {
      s: { type: ['string', 'null'] },
      sr: { type: ['null', 'string'] },
      sd: { type: ['string', 'null'], format: 'date-time' },
      sdef: { type: ['string', 'null'], default: 'd' },
      n: { type: ['number', 'null'] },
      b: { type: ['boolean', 'null'] },
      arr: { type: 'array', items: { type: ['string', 'null'] } }
    }
  }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })
  const cases = [
    { s: 'x', sr: 'y', sd: new Date(0), sdef: 'z', n: 1.5, b: true, arr: ['a', null] },
    { s: null, sr: null, sd: null, sdef: null, n: null, b: null, arr: [null] },
    {},
    { s: new Date(0) },
    { s: /re/ },
    { s: { toString () { return 'custom' } } },
    { s: {} },
    { s: 5 },
    { s: true },
    { sd: '2020-01-01' },
    { sd: 5 },
    { n: Infinity },
    { n: NaN },
    { n: '3' },
    { n: 10n },
    { b: 'y' },
    { b: 0 },
    { arr: ['a', 5] },
    { arr: [new Date(0)] }
  ]
  t.plan(cases.length + 2)
  t.assert.ok(build(schema, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'), 'schema is projected')
  for (const c of cases) t.assert.deepStrictEqual(run(nat, c), run(def, c), JSON.stringify(c, (k, v) => typeof v === 'bigint' ? 'bigint' : v))
  // ['integer', 'null'] and non-null multi-types are not projected
  const notProjected = [{ type: ['integer', 'null'] }, { type: ['string', 'number'] }, { type: ['string', 'null', 'number'] }, { type: ['string', 'null'], format: 'email' }]
  t.assert.ok(notProjected.every((p) => !build({ type: 'object', properties: { a: p } }, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue')))
})

test('native mechanism projects the realistic api-response fixtures byte for byte', t => {
  const fixtures = require('../benchmark/fixtures/api-responses')
  t.plan(fixtures.length * 2)
  for (const { name, schema, input } of fixtures) {
    const def = build(schema)
    const nat = build(schema, { objectMechanism: 'native' })
    t.assert.ok(build(schema, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'), `${name} is projected`)
    t.assert.equal(nat(input), def(input), name)
  }
})

test('native mechanism: array elements never share scratch objects (no aliasing)', t => {
  // items[].product.images[] : an array of objects inside an array of objects.
  // Every element must get its own scratch tree, otherwise the last element
  // written wins for all of them.
  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        images: { type: 'array', items: { type: 'object', properties: { url: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } } } },
        meta: { type: 'object', properties: { k: { type: 'string' } } }
      }
    }
  }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })
  const a = [
    { id: 1, images: [{ url: 'a', tags: ['x'] }, { url: 'b', tags: [] }], meta: { k: '1' } },
    { id: 2, images: [{ url: 'c', tags: ['y', 'z'] }], meta: { k: '2' } },
    { id: 3, images: [], meta: null }
  ]
  const b = [{ id: 9, images: [{ url: 'q', tags: ['k'] }] }]
  t.plan(4)
  t.assert.equal(nat(a), def(a))
  t.assert.equal(nat(b), def(b))
  t.assert.equal(nat(a), def(a), 'shrinking then growing again keeps elements independent')
  t.assert.ok(nat(a).includes('"url":"a"') && nat(a).includes('"url":"c"'))
})
