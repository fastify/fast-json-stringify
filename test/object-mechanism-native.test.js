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
  'date-time given as a number throws': { id: 1, createdAt: 1700000000000 },
  'date-time given as an object throws': { id: 1, createdAt: { toString () { return 'custom' } } },
  'date given as a number throws': { id: 1, birthday: 1700000000000 },
  'time given as a number throws': { id: 1, at: 1700000000000 },
  'toJSON on root': { id: 1, toJSON () { return { id: 7, name: 'json' } } },
  'toJSON on nested object': { id: 1, address: { toJSON () { return { city: 'Roma' } } } },
  'toJSON on array item': { id: 1, friends: [{ toJSON () { return { id: 9 } } }] },
  'required missing on root throws': { name: 'no id' },
  'required missing on nested throws': { id: 1, address: { street: 'x' } },
  'NaN throws': { id: 1, score: NaN },
  'Infinity becomes null': { id: 1, score: Infinity },
  'bigint integer': { id: 10n },
  'bigint at the safe integer limits': { id: 9007199254740991n, friends: [{ id: -9007199254740991n }] },
  'bigint just outside the safe integer range': { id: 9007199254740992n, friends: [{ id: -9007199254740992n }] },
  'bigint outside the safe integer range keeps every digit': { ...base, id: 2n ** 64n },
  'negative bigint outside the safe integer range': { id: -(2n ** 64n) },
  'bigint outside the safe integer range in an array item': {
    id: 1,
    name: 'a"b\\c\n',
    active: false,
    score: Infinity,
    address: undefined,
    tags: [],
    scores: [1.5],
    friends: [{ id: 2n ** 70n, name: 'big' }, {}, { id: 3 }, null]
  },
  'date given as a string that needs escaping': { id: 1, birthday: 'a"b\\c\n\u2028' },
  'time given as a string that needs escaping': { id: 1, at: '"\ud83d\u0000' },
  'date and time given as plain strings': { id: 1, birthday: '2020-01-01', at: '10:00:00' },
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

test('native mechanism: Date values match the default mechanism', t => {
  const schema = {
    type: 'object',
    properties: {
      at: { type: 'string', format: 'date-time' },
      maybe: { type: ['string', 'null'], format: 'date-time' },
      list: { type: 'array', items: { type: 'string', format: 'date-time' } },
      plain: { type: 'string' },
      plainMaybe: { type: ['string', 'null'] },
      plainList: { type: 'array', items: { type: 'string' } }
    }
  }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })

  class LocalDate extends Date {
    toISOString () { return 'overridden' }
  }

  const dates = [
    new Date(0),
    new Date(1),
    new Date(-1),
    new Date('2024-02-29T23:59:59.999Z'),
    new Date('1999-12-31T00:00:00.000Z'),
    new Date('2026-01-09T08:07:06.005Z'),
    new Date('0000-01-01T00:00:00.000Z'),
    new Date('9999-12-31T23:59:59.999Z'),
    new Date(-62167219200001), // one millisecond before year 0
    new Date(253402300800000), // first millisecond of year 10000
    new Date(8.64e15),
    new Date(-8.64e15),
    new Date(NaN),
    new LocalDate(86400000)
  ]

  t.plan(dates.length + 2)
  for (const date of dates) {
    const input = { at: date, maybe: date, list: [date, date], plain: date, plainMaybe: date, plainList: [date, date] }
    t.assert.deepStrictEqual(run(nat, input), run(def, input), String(date.getTime()))
  }
  t.assert.equal(
    nat({ at: new Date(0), maybe: null, list: [], plain: new Date(1), plainMaybe: null, plainList: [] }),
    '{"at":"1970-01-01T00:00:00.000Z","maybe":null,"list":[],"plain":"1970-01-01T00:00:00.001Z","plainMaybe":null,"plainList":[]}'
  )
  t.assert.equal(nat({ at: '2020-01-01T00:00:00.000Z' }), def({ at: '2020-01-01T00:00:00.000Z' }))
})

test('native mechanism: arrays that keep their length, grow, shrink and become null between calls', t => {
  const schema = {
    type: 'object',
    properties: {
      tags: { type: 'array', items: { type: 'string' } },
      scores: { type: 'array', items: { type: 'number' } },
      rows: {
        type: 'array',
        items: { type: 'object', properties: { id: { type: 'integer' }, labels: { type: 'array', items: { type: 'string' } } } }
      }
    }
  }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })
  const make = (n, seed) => ({
    tags: Array.from({ length: n }, (_, i) => 't' + seed + i),
    scores: Array.from({ length: n }, (_, i) => seed + i + 0.5),
    rows: Array.from({ length: n }, (_, i) => ({ id: seed + i, labels: Array.from({ length: (i + n) % 4 }, (_, j) => 'l' + seed + j) }))
  })
  const inputs = [
    make(0, 1), make(0, 2), make(5, 3), make(5, 4), make(2, 5), make(9, 6), make(9, 7),
    { tags: null, scores: null, rows: null }, make(3, 8), {}, make(3, 9), make(1, 10), make(9, 11)
  ]
  t.plan(inputs.length)
  for (const input of inputs) t.assert.equal(nat(input), def(input))
})

test('native mechanism generates projection code only for projectable schemas', t => {
  const projectable = [
    userSchema,
    { type: 'object', properties: { a: { type: 'string' } } },
    { type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } },
    { type: 'object', properties: { a: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } },
    { type: 'object', properties: { a: { type: 'array', items: { type: 'object', properties: { b: { type: 'object', properties: { c: { type: 'string' } } } } } } } },
    { type: 'object', properties: { a: { type: ['string', 'null'] } } },
    { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false },
    { type: 'object', nullable: true, properties: { a: { type: 'string' } } },
    { type: 'object', properties: { a: { type: 'string', nullable: true } } },
    { type: 'object', properties: { a: { type: 'string', enum: ['x'] } } },
    { type: 'object', properties: { a: { type: 'string', format: 'email' } } },
    { type: 'object', properties: { a: { type: 'integer', format: 'int64' } } },
    { type: 'object', properties: { a: { type: ['string', 'null'], format: 'email' } } },
    { type: 'object', properties: { a: { type: ['number', 'null'], format: 'float' } } },
    { type: 'object', properties: { a: { type: 'array', nullable: true, items: { type: 'string' } } } }
  ]
  const notProjectable = [
    { type: 'string' },
    { type: 'object', properties: {} },
    { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: true },
    { type: 'object', properties: { a: { type: 'string' } }, patternProperties: { '^x': { type: 'string' } } },
    { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: { type: 'string' } },
    { type: 'object', properties: { a: { type: ['string', 'number'] } } },
    { type: 'object', properties: { a: { type: ['integer', 'null'] } } },
    { type: 'object', properties: { a: { const: 'x' } } },
    { type: 'object', properties: { a: { enum: ['x'] } } },
    { type: 'object', properties: { a: { nullable: true } } },
    { type: 'object', properties: { a: { anyOf: [{ type: 'string' }] } } },
    { type: 'object', properties: { a: { type: 'string', format: 'unsafe' } } },
    { type: 'object', properties: { a: { type: ['string', 'null'], format: 'unsafe' } } },
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

test('native mechanism: $ref is projected and matches the default mechanism', t => {
  const user = {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'integer' },
      name: { type: ['string', 'null'] },
      'a/b': { type: ['number', 'null'] },
      tags: { type: 'array', items: { type: 'string' } }
    }
  }
  const external = {
    $id: 'external',
    type: 'object',
    properties: { street: { type: 'string' }, city: { $ref: '#/definitions/city' } },
    definitions: {
      city: { type: 'object', nullable: true, properties: { name: { type: ['string', 'null'] } } },
      zip: { type: 'string' }
    }
  }
  const list = { $id: 'list', type: 'array', items: { $ref: 'external#/definitions/city' } }
  const options = { schema: { external, list } }
  const schemas = [
    // the same definition used twice and inside an array
    {
      type: 'object',
      definitions: { user },
      properties: {
        owner: { $ref: '#/definitions/user' },
        editor: { $ref: '#/definitions/user', description: 'a keyword that does not change the target' },
        members: { type: 'array', items: { $ref: '#/definitions/user' } }
      }
    },
    // a $ref to a $ref, and a $ref inside a definition
    {
      type: 'object',
      definitions: { a: { $ref: '#/definitions/b' }, b: { type: 'object', properties: { owner: { $ref: '#/definitions/user' } } }, user },
      properties: { owner: { $ref: '#/definitions/a' }, members: { type: 'array', items: { $ref: '#/definitions/a' } } }
    },
    // external schemas, with a $ref relative to them, a sub-schema and an anchor
    {
      $id: 'http://example.com/root.json',
      type: 'object',
      definitions: { anchored: { $id: '#anchor', type: 'object', properties: { name: { type: ['string', 'null'] } } } },
      properties: {
        owner: { $ref: 'external#' },
        editor: { $ref: 'external' },
        members: { $ref: 'list' },
        tags: { $ref: 'external#/definitions/zip' },
        id: { $ref: 'external#/properties/street' },
        name: { $ref: '#anchor' }
      }
    }
  ]
  const noPrototype = Object.assign(Object.create(null), { id: 1 })
  const values = [
    { id: 1, name: 'x', 'a/b': 1.5, tags: ['a', 'b'], street: 's', city: { name: 'c' }, extra: 'dropped' },
    { id: 2, name: null, 'a/b': null, tags: [], city: null },
    { id: 3, name: 5 },
    { id: 4, 'a/b': 'text' },
    { id: 5, tags: 'text' },
    { id: 6, city: { name: 5 } },
    { name: 'no id' },
    { toJSON () { return { id: 7, name: 'from toJSON' } } },
    {},
    null,
    'text',
    [{ name: 'in a list' }, null, { name: 5 }]
  ]
  let checks = 0
  for (const schema of schemas) {
    t.assert.ok(build(schema, { ...options, objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'), `projected: ${JSON.stringify(schema)}`)
    const nat = build(schema, { ...options, objectMechanism: 'native' })
    const def = build(schema, options)
    const inputs = [null, {}, ...values]
    for (const a of values) {
      for (const b of values) {
        inputs.push({ owner: a, editor: b, members: [a, b, a], tags: a, id: b, name: a })
      }
    }
    for (const input of inputs) {
      const expected = run(def, input)
      t.assert.deepStrictEqual([run(nat, input), run(nat, input)], [expected, expected])
      checks++
    }
  }
  t.assert.ok(checks > 400)

  // each use of a definition has its own scratch
  const twice = build(schemas[0], { objectMechanism: 'native' })
  t.assert.equal(
    twice({ owner: { id: 1, name: 'a' }, editor: { id: 2, tags: ['t'] }, members: [{ id: 3 }, { id: 4, name: 'd' }] }),
    '{"owner":{"id":1,"name":"a"},"editor":{"id":2,"tags":["t"]},"members":[{"id":3},{"id":4,"name":"d"}]}'
  )
  // the pointer in an error is the one of the target, with its escaped key
  t.assert.throws(() => twice({ owner: { id: 1, 'a/b': 'text' } }), new TypeError("The value of '#/definitions/user/properties/a~1b' does not match schema definition."))
  // a required key that is not a property, on an object without a prototype
  const required = { type: 'object', required: ['constructor'], properties: { id: { type: 'integer' } } }
  t.assert.deepStrictEqual(run(build(required, { objectMechanism: 'native' }), noPrototype), run(build(required), noPrototype))
  t.assert.deepStrictEqual(run(build(required, { objectMechanism: 'native' }), noPrototype), { err: 'Error: "constructor" is required!' })
  // a $ref that cannot be found is the same error
  const missing = { type: 'object', properties: { a: { $ref: '#/definitions/missing' } } }
  t.assert.throws(() => build(missing, { objectMechanism: 'native' }), /Cannot find reference "#\/definitions\/missing"/)
})

test('native mechanism: an empty $ref is not a reference, as in the default mechanism', t => {
  const external = {
    $id: 'external',
    type: 'object',
    properties: { a: { type: 'string' } },
    definitions: { d: { type: 'object', properties: { x: { $ref: '' }, y: { type: 'string' } } } }
  }
  const cases = [
    [{ $ref: '' }, { a: 1 }],
    [{ type: 'object', properties: { a: { $ref: '' }, b: { type: 'string' } } }, { a: { z: 1 }, b: 'x' }],
    [{ type: 'object', properties: { a: { type: 'string', $ref: '' } } }, { a: 5 }],
    [{ type: 'array', items: { $ref: '' } }, [{ z: 1 }, 2]],
    [{ type: 'object', properties: { p: { $ref: 'external#/definitions/d' } } }, { p: { x: { a: 'in', other: 1 }, y: 'y' } }]
  ]
  t.plan(cases.length + 2)
  for (const [schema, input] of cases) {
    const options = { schema: { external } }
    t.assert.deepStrictEqual(
      run(build(schema, { ...options, objectMechanism: 'native' }), input),
      run(build(schema, options), input)
    )
  }
  // the value under an empty $ref has no type: it is written as it is
  t.assert.equal(build(cases[4][0], { schema: { external }, objectMechanism: 'native' })(cases[4][1]), '{"p":{"x":{"a":"in","other":1},"y":"y"}}')
  // with a type next to it, the node is projected like any other
  t.assert.ok(build(cases[2][0], { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'))
})

test('native mechanism: a $ref the projection does not cover keeps the default mechanism', t => {
  const leaf = { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } } }
  // 4 x 4 x 4 x 4 uses of a 4-node schema: more than 1000 nodes once expanded
  const wide = (target) => ({ type: 'object', properties: { p0: { $ref: target }, p1: { $ref: target }, p2: { $ref: target }, p3: { $ref: target } } })
  const notProjectable = [
    // keywords next to a $ref are merged with its target, definitions included
    { $ref: '#/definitions/o', definitions: { o: { type: 'object', properties: { a: { type: 'string' } } } } },
    { type: 'object', definitions: { s: { type: 'string' } }, properties: { a: { $ref: '#/definitions/s', nullable: true } } },
    // recursive, directly and through another definition
    { type: 'object', definitions: { node: { type: 'object', properties: { value: { type: 'string' }, next: { $ref: '#/definitions/node' } } } }, properties: { head: { $ref: '#/definitions/node' } } },
    { $id: 'tree', type: 'object', properties: { children: { type: 'array', items: { $ref: 'tree#' } } } },
    {
      type: 'object',
      definitions: {
        a: { type: 'object', properties: { b: { $ref: '#/definitions/b' } } },
        b: { type: 'object', properties: { a: { $ref: '#/definitions/a' } } }
      },
      properties: { a: { $ref: '#/definitions/a' } }
    },
    // the target is not projectable
    { type: 'object', definitions: { s: { anyOf: [{ type: 'string' }, { type: 'number' }] } }, properties: { a: { $ref: '#/definitions/s' } } },
    { type: 'object', definitions: { s: true }, properties: { a: { $ref: '#/definitions/s' } } },
    { type: 'object', definitions: { l: { type: 'array', items: { anyOf: [{ type: 'string' }] } } }, properties: { a: { $ref: '#/definitions/l' } } },
    { type: 'object', definitions: { d0: leaf, d1: wide('#/definitions/d0'), d2: wide('#/definitions/d1'), d3: wide('#/definitions/d2'), d4: wide('#/definitions/d3') }, properties: { a: { $ref: '#/definitions/d4' } } }
  ]
  const inputs = [
    { a: 'x' },
    { a: null },
    { a: ['x'] },
    { head: { value: 'x', next: { value: 'y', next: null } } },
    { children: [{ children: [] }] },
    { a: { b: { a: {} } } },
    { a: { p0: { p1: { p2: { p3: { a: 'deep' } } } } } },
    {}
  ]
  t.plan(notProjectable.length * (inputs.length + 1) + 1)
  for (const schema of notProjectable) {
    t.assert.ok(!build(schema, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'), JSON.stringify(schema))
    const nat = build(schema, { objectMechanism: 'native' })
    const def = build(schema)
    for (const input of inputs) t.assert.deepStrictEqual(run(nat, input), run(def, input))
  }
  // the same shape, one level less, is small enough to be projected
  const small = { type: 'object', definitions: { d0: leaf, d1: wide('#/definitions/d0'), d2: wide('#/definitions/d1'), d3: wide('#/definitions/d2') }, properties: { a: { $ref: '#/definitions/d3' } } }
  t.assert.ok(build(small, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'))
})

test('native mechanism: unsupported schemas keep the default output', t => {
  const schema = {
    type: 'object',
    properties: { a: { type: 'string' }, b: { type: 'string', format: 'unsafe' } },
    additionalProperties: { type: 'number' }
  }
  const data = { a: 'x', b: 'y', c: 1, d: 2 }
  t.plan(1)
  t.assert.equal(build(schema, { objectMechanism: 'native' })(data), build(schema)(data))
})

test('native mechanism: nullable, enum, format and additionalProperties false match the default mechanism', t => {
  class Entity {
    constructor (value) { this.value = value }
    toJSON () { return this.value }
  }
  const valuesByType = {
    string: ['x', 'needs "escaping"\n', '', 5, true, new Date(0), /re/, { toString () { return 'custom' } }],
    number: [1.5, 0, -0, '3', Infinity, NaN, 10n, true],
    integer: [1, 1.5, '3', 10n, 2n ** 64n, NaN, true],
    boolean: [true, false, 0, 'y', ''],
    object: [{ a: 'x' }, { a: null }, {}, { a: 'x', extra: 1 }, new Entity({ a: 'x' }), new Entity(null), 'text', 5],
    array: [['x'], [], [null, 'y'], 'text', 5, {}]
  }
  const keywordsByType = {
    string: [{}, { format: 'email' }, { format: 'uuid' }, { format: 'date-time' }, { format: 'date' }, { format: 'time' }, { enum: ['x', 'y'] }, { default: 'd' }],
    number: [{}, { format: 'float' }, { enum: [1, 2] }, { default: 7 }],
    integer: [{}, { format: 'int64' }, { enum: [1, 2] }],
    boolean: [{}, { enum: [true] }, { format: 'ignored' }],
    object: [{ properties: { a: { type: 'string', nullable: true } } }, { properties: { a: { type: 'string' } }, additionalProperties: false, required: ['a'] }],
    array: [{ items: { type: 'string', nullable: true } }, { items: { type: 'object', nullable: true, additionalProperties: false, properties: { a: { type: 'string' } } } }]
  }
  const multiTypes = [
    [{ type: ['string', 'null'] }, valuesByType.string],
    [{ type: ['null', 'string'], format: 'email' }, valuesByType.string],
    [{ type: ['number', 'null'], format: 'float' }, valuesByType.number],
    [{ type: ['boolean', 'null'], enum: [true, null] }, valuesByType.boolean]
  ]
  const label = (v) => JSON.stringify(v, (k, x) => typeof x === 'bigint' ? `${x}n` : x instanceof RegExp ? String(x) : x)

  const variants = []
  for (const type of Object.keys(valuesByType)) {
    for (const keywords of keywordsByType[type]) {
      for (const nullable of [true, false]) {
        const schema = nullable ? { type, nullable, ...keywords } : { type, ...keywords }
        variants.push([schema, valuesByType[type]])
      }
    }
  }
  for (const [schema, values] of multiTypes) {
    variants.push([schema, values], [{ ...schema, nullable: true }, values])
  }

  let checks = 0
  for (const [schema, values] of variants) {
    const wrappers = [
      { type: 'object', additionalProperties: false, properties: { p: schema, last: { type: 'boolean' } } },
      { type: 'object', required: ['p'], properties: { p: schema } },
      { type: 'object', nullable: true, properties: { list: { type: 'array', nullable: true, items: schema } } }
    ]
    for (const wrapper of wrappers) {
      const nat = build(wrapper, { objectMechanism: 'native' })
      const def = build(wrapper)
      t.assert.ok(build(wrapper, { objectMechanism: 'native', mode: 'debug' }).code.includes('asStringValue'), `projected: ${label(wrapper)}`)
      checks++
      const inputs = [null, {}, { p: null, list: null }, { p: undefined, list: [] }, new Entity(null)]
      for (const value of [null, ...values]) {
        inputs.push({ p: value, last: 1, extra: 'dropped', list: [value, null, value] })
        inputs.push(new Entity({ p: value, list: [value] }))
      }
      for (const input of inputs) {
        const twice = [run(nat, input), run(nat, input)]
        const expected = run(def, input)
        t.assert.deepStrictEqual(twice, [expected, expected], `${label(wrapper)} <- ${label(input)}`)
        checks++
      }
    }
  }
  t.assert.ok(checks > 3000)

  // a nullable root, after a call that filled the scratch
  const root = build({ type: 'object', nullable: true, properties: { a: { type: 'string' } } }, { objectMechanism: 'native' })
  t.assert.equal(root({ a: 'x' }), '{"a":"x"}')
  t.assert.equal(root(null), 'null')
  t.assert.equal(root({ a: 'y' }), '{"a":"y"}')
  const list = build({ type: 'array', nullable: true, items: { type: 'string', nullable: true } }, { objectMechanism: 'native' })
  t.assert.equal(list(['x', null]), '["x",null]')
  t.assert.equal(list(null), 'null')
  t.assert.equal(list([]), '[]')
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
  const notProjected = [{ type: ['integer', 'null'] }, { type: ['string', 'number'] }, { type: ['string', 'null', 'number'] }, { type: ['string', 'null'], format: 'unsafe' }]
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

test('native mechanism: a default satisfies a required property, like the default codegen', t => {
  const schema = {
    type: 'object',
    required: ['a', 'b', 'nested'],
    properties: {
      a: { type: 'string', default: 'da' },
      b: { type: 'integer' },
      nested: {
        type: 'object',
        default: { c: 'from default' },
        required: ['c'],
        properties: { c: { type: 'string', default: 'dc' } }
      },
      list: { type: 'array', items: { type: 'object', required: ['n'], properties: { n: { type: 'number', default: 1.5 } } } }
    }
  }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })
  const cases = [
    { b: 1 },
    { a: 'x', b: 1, nested: {} },
    { a: undefined, b: 1, nested: { c: undefined }, list: [{}, { n: 2 }, { n: undefined }] },
    { a: 'x' },
    {}
  ]
  t.plan(cases.length)
  for (const c of cases) t.assert.deepStrictEqual(run(nat, c), run(def, c), JSON.stringify(c))
})

test('native mechanism: bigint array items outside the safe integer range', t => {
  const data = [1, 2n, 2n ** 64n, -(2n ** 64n), 9007199254740991n, 9007199254740992n, 3]
  const schemas = [
    { type: 'array', items: { type: 'integer' } },
    { type: 'object', properties: { ids: { type: 'array', items: { type: 'integer' } }, name: { type: 'string' } } }
  ]
  t.plan(4)
  for (const schema of schemas) {
    const def = build(schema)
    const nat = build(schema, { objectMechanism: 'native' })
    const input = schema.type === 'array' ? data : { ids: data, name: 'n' }
    t.assert.deepStrictEqual(run(nat, input), run(def, input))
    // the next call goes back to the native JSON.stringify and to plain numbers
    const small = schema.type === 'array' ? [1, 2] : { ids: [1, 2], name: 'n' }
    t.assert.deepStrictEqual(run(nat, small), run(def, small))
  }
})

test('native mechanism: a serializer can be called again while it is serializing', t => {
  const schema = {
    type: 'object',
    properties: {
      a: { type: 'string' },
      b: { type: 'string' },
      c: { type: 'string' },
      list: { type: 'array', items: { type: 'object', properties: { x: { type: 'string' } } } }
    }
  }
  const def = build(schema)
  const nat = build(schema, { objectMechanism: 'native' })

  // `depth` nested calls: the getter of `b` serializes another object with the
  // same serializer before the outer call has read `c` and `list`.
  const reentrant = (stringify, depth, seen) => ({
    a: 'a' + depth,
    get b () {
      if (depth > 0) seen.push(stringify(reentrant(stringify, depth - 1, seen)))
      return 'b' + depth
    },
    c: 'c' + depth,
    list: [{ x: 'x' + depth }, { x: 'y' + depth }]
  })

  // an array item whose toJSON() serializes another object
  class Row {
    constructor (x, stringify) { this.x = x; this.stringify = stringify }
    toJSON () {
      this.stringify({ a: 'inner', b: 'inner', c: 'inner', list: [{ x: 'inner 1' }, { x: 'inner 2' }, { x: 'inner 3' }] })
      return { x: this.x }
    }
  }
  const withRows = (stringify) => ({ a: 'a', b: 'b', c: 'c', list: [{ x: 'first' }, new Row('second', stringify), { x: 'third' }] })

  const throwing = (stringify) => ({
    a: 'a',
    get b () {
      try { stringify({ a: 'inner', get b () { throw new Error('inner failure') } }) } catch {}
      return 'b'
    },
    c: 'c',
    list: [{ x: 'x' }]
  })

  t.plan(10)
  for (const depth of [1, 2, 3]) {
    const seenNative = []
    const seenDefault = []
    t.assert.equal(nat(reentrant(nat, depth, seenNative)), def(reentrant(def, depth, seenDefault)), `outer output, depth ${depth}`)
    t.assert.deepStrictEqual(seenNative, seenDefault, `inner outputs, depth ${depth}`)
  }
  t.assert.equal(nat(withRows(nat)), def(withRows(def)))
  t.assert.equal(nat(throwing(nat)), def(throwing(def)), 'an error in a nested call does not affect the outer one')
  t.assert.throws(() => nat({ get a () { throw new Error('outer failure') } }), /outer failure/)
  // after an error the serializer is not left in the "serializing" state
  t.assert.equal(nat({ a: '1', b: '2', c: '3', list: [{ x: '4' }] }), '{"a":"1","b":"2","c":"3","list":[{"x":"4"}]}')
})
