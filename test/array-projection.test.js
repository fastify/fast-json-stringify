'use strict'

// The projection fast path is enabled by default only on V8 >= 13.8. These
// tests force it on so the same assertions run on every supported runtime; the
// output must be identical either way.

const { test } = require('node:test')

const buildDefault = require('..')

const build = (schema, options) => buildDefault(schema, { ...options, arrayProjection: true })

const itemSchema = {
  type: 'object',
  properties: {
    firstName: { type: 'string' },
    lastName: { type: ['string', 'null'] },
    age: { type: 'integer' }
  }
}

test('projected arrays drop properties outside the schema', (t) => {
  t.plan(1)

  const stringify = build({ type: 'array', items: itemSchema })
  const input = new Array(8).fill({ firstName: 'Matteo', lastName: 'Collina', age: 32, secret: 'nope' })

  t.assert.equal(
    stringify(input),
    '[' + new Array(8).fill('{"firstName":"Matteo","lastName":"Collina","age":32}').join(',') + ']'
  )
})

test('projected arrays keep the schema property order, required first', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } },
      required: ['c']
    }
  })

  t.assert.equal(stringify([{ a: '1', b: '2', c: '3' }, { a: '4', b: '5', c: '6' }]), '[{"c":"3","a":"1","b":"2"},{"c":"6","a":"4","b":"5"}]')
})

test('projected arrays omit undefined optional properties', (t) => {
  t.plan(1)

  const stringify = build({ type: 'array', items: itemSchema })

  t.assert.equal(stringify([{ firstName: 'Matteo' }, { age: 32 }]), '[{"firstName":"Matteo"},{"age":32}]')
})

test('projected arrays still throw on a missing required property', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }
  })

  t.assert.throws(() => stringify([{ a: 'ok' }, {}, { a: 'ok' }]), /"a" is required!/)
})

test('a bigint anywhere in the array falls back to the concatenation path', (t) => {
  t.plan(2)

  const stringify = build({ type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } } } })

  t.assert.equal(stringify([{ id: 1 }, { id: 2 }]), '[{"id":1},{"id":2}]')
  t.assert.equal(stringify([{ id: 1 }, { id: 9007199254740993n }]), '[{"id":1},{"id":9007199254740993}]')
})

test('projected arrays honour toJSON on the items', (t) => {
  t.plan(1)

  const stringify = build({ type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } })

  class Item {
    toJSON () { return { a: 'fromToJSON' } }
  }

  t.assert.equal(stringify([new Item(), new Item()]), '[{"a":"fromToJSON"},{"a":"fromToJSON"}]')
})

test('projected arrays escape strings the same way', (t) => {
  t.plan(1)

  const stringify = build({ type: 'array', items: { type: 'string' } })
  const input = ['quote " here', 'back\\slash', 'ctrlchar', '\ud800lone surrogate', 'plain']

  t.assert.equal(stringify(input), JSON.stringify(input))
})

test('projected arrays coerce like the concatenation path', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        s: { type: 'string' },
        i: { type: 'integer' },
        n: { type: 'number' },
        b: { type: 'boolean' }
      }
    }
  })

  const input = new Array(4).fill({ s: 42, i: 3.7, n: '2.5', b: 'truthy' })

  t.assert.equal(
    stringify(input),
    '[' + new Array(4).fill('{"s":"42","i":3,"n":2.5,"b":true}').join(',') + ']'
  )
})

test('projected arrays render dates through the schema format', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { at: { type: 'string', format: 'date-time' } } }
  })

  const at = new Date('2020-01-02T03:04:05.678Z')

  t.assert.equal(stringify([{ at }, { at }]), '[{"at":"2020-01-02T03:04:05.678Z"},{"at":"2020-01-02T03:04:05.678Z"}]')
})

test('nullable items and null property values are preserved', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      nullable: true,
      properties: { a: { type: 'string', nullable: true }, b: { type: ['integer', 'null'] } }
    }
  })

  t.assert.equal(stringify([null, { a: null, b: null }, { a: 'x', b: 1 }]), '[null,{"a":null,"b":null},{"a":"x","b":1}]')
})

test('integer-like property names keep their schema order', (t) => {
  t.plan(1)

  // "b" is required so it is serialized first, but an object literal would
  // hoist the integer-like "1" ahead of it. This schema must not be projected.
  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { b: { type: 'string' }, 1: { type: 'string' } }, required: ['b'] }
  })

  t.assert.equal(stringify([{ b: 'bee', 1: 'one' }, { b: 'bee', 1: 'one' }]), '[{"b":"bee","1":"one"},{"b":"bee","1":"one"}]')
})

test('additionalProperties are still serialized', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: true }
  })

  t.assert.equal(stringify([{ a: 'x', extra: 1 }, { a: 'y', extra: 2 }]), '[{"a":"x","extra":1},{"a":"y","extra":2}]')
})

test('arrays nested inside projected items are projected too', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } }
  })

  t.assert.equal(stringify([{ tags: ['a', 'b'] }, { tags: [] }]), '[{"tags":["a","b"]},{"tags":[]}]')
})

test('short arrays take the concatenation path and agree with long ones', (t) => {
  t.plan(4)

  const stringify = build({ type: 'array', items: itemSchema })
  const row = { firstName: 'Matteo', lastName: null, age: 32 }
  const expected = '{"firstName":"Matteo","lastName":null,"age":32}'

  for (const length of [0, 1, 2, 16]) {
    t.assert.equal(stringify(new Array(length).fill(row)), '[' + new Array(length).fill(expected).join(',') + ']')
  }
})

test('union types with null are projected', (t) => {
  t.plan(2)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        o: { type: ['object', 'null'], properties: { a: { type: 'string' } } },
        l: { type: ['array', 'null'], items: { type: 'integer' } },
        b: { type: ['boolean', 'null'] },
        n: { type: ['number', 'null'] }
      }
    }
  })

  t.assert.equal(stringify([{ o: { a: 'x' }, l: [1, 2], b: true, n: 1.5 }, { o: null, l: null, b: null, n: null }]),
    '[{"o":{"a":"x"},"l":[1,2],"b":true,"n":1.5},{"o":null,"l":null,"b":null,"n":null}]')

  t.assert.throws(() => stringify([{ b: 'not a boolean' }, {}]), /does not match schema definition/)
})

test('a union whose non-null branch is not projectable declines', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        o: { type: ['object', 'null'], properties: { a: { type: 'string' } }, additionalProperties: true }
      }
    }
  })

  t.assert.equal(stringify([{ o: { a: 'one', x: 2 } }, { o: null }]), '[{"o":{"a":"one","x":2}},{"o":null}]')
})

test('the unsafe string format declines projection', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: { type: 'string', format: 'unsafe' } } }
  })

  t.assert.equal(stringify([{ a: 'no "escaping"' }, { a: 'x' }]), '[{"a":"no "escaping""},{"a":"x"}]')
})

test('a schema object reused for two properties is projected once', (t) => {
  t.plan(1)

  const shared = { type: 'object', properties: { v: { type: 'string' } } }
  const sharedList = { type: 'array', items: { type: 'integer' } }
  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: shared, b: shared, c: sharedList, d: sharedList } }
  })

  t.assert.equal(
    stringify([{ a: { v: '1' }, b: { v: '2' }, c: [1], d: [2] }, { a: { v: '3' }, b: { v: '4' }, c: [3], d: [4] }]),
    '[{"a":{"v":"1"},"b":{"v":"2"},"c":[1],"d":[2]},{"a":{"v":"3"},"b":{"v":"4"},"c":[3],"d":[4]}]'
  )
})

test('an item object without properties projects to an empty object', (t) => {
  t.plan(1)

  const stringify = build({ type: 'array', items: { type: 'object' } })

  t.assert.equal(stringify([{ a: 1 }, { b: 2 }]), '[{},{}]')
})

test('a required property missing from properties declines projection', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: { type: 'string' } }, required: ['b'] }
  })

  t.assert.throws(() => stringify([{ a: 'x' }, { a: 'y' }]), /"b" is required!/)
})

test('mixed required and optional properties keep required first', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' }, d: { type: 'string' } },
      required: ['c', 'd']
    }
  })

  t.assert.equal(stringify([{ a: '1', b: '2', c: '3', d: '4' }, { a: '5', b: '6', c: '7', d: '8' }]),
    '[{"c":"3","d":"4","a":"1","b":"2"},{"c":"7","d":"8","a":"5","b":"6"}]')
})

test('a required property declared first still sorts ahead', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: { c: { type: 'string' }, a: { type: 'string' } },
      required: ['c']
    }
  })

  t.assert.equal(stringify([{ a: '1', c: '2' }, { a: '3', c: '4' }]), '[{"c":"2","a":"1"},{"c":"4","a":"3"}]')
})

test('nested tuple arrays and additionalItems decline projection', (t) => {
  t.plan(2)

  const tuple = build({
    type: 'array',
    items: { type: 'object', properties: { t: { type: 'array', items: [{ type: 'string' }, { type: 'integer' }] } } }
  })
  t.assert.equal(tuple([{ t: ['a', 1] }, { t: ['b', 2] }]), '[{"t":["a",1]},{"t":["b",2]}]')

  const additional = build({
    type: 'array',
    items: { type: 'object', properties: { t: { type: 'array', items: [{ type: 'string' }], additionalItems: true } } }
  })
  t.assert.equal(additional([{ t: ['a', 1] }, { t: ['b', 2] }]), '[{"t":["a",1]},{"t":["b",2]}]')
})

test('a nested array without items declines projection', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { t: { type: 'array' } } }
  })

  t.assert.equal(stringify([{ t: ['a', 1] }, { t: [] }]), '[{"t":["a",1]},{"t":[]}]')
})

test('a nested array of non-projectable items declines projection', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: { t: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'integer' }] } } }
    }
  })

  t.assert.equal(stringify([{ t: ['a', 1] }, { t: [2] }]), '[{"t":["a",1]},{"t":[2]}]')
})

test('a nullable nested array renders null', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { t: { type: 'array', nullable: true, items: { type: 'string' } } } }
  })

  t.assert.equal(stringify([{ t: null }, { t: ['a'] }]), '[{"t":null},{"t":["a"]}]')
})

test('a nested array is rejected when the value is not an array', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { t: { type: 'array', items: { type: 'string' } } } }
  })

  t.assert.throws(() => stringify([{ t: 'not an array' }, { t: ['a'] }]), /does not match schema definition/)
})

test('arrayProjection can be turned off', (t) => {
  t.plan(2)

  const schema = { type: 'array', items: itemSchema }
  const input = new Array(8).fill({ firstName: 'Matteo', lastName: 'Collina', age: 32 })
  const expected = '[' + new Array(8).fill('{"firstName":"Matteo","lastName":"Collina","age":32}').join(',') + ']'

  t.assert.equal(buildDefault(schema, { arrayProjection: false })(input), expected)
  t.assert.equal(buildDefault(schema, { arrayProjection: true })(input), expected)
})

test('arrayProjection must be a boolean', (t) => {
  t.plan(1)

  t.assert.throws(
    () => buildDefault({ type: 'array', items: itemSchema }, { arrayProjection: 'yes' }),
    /Unsupported array projection option yes/
  )
})

test('an array nested in an object is projected in place', (t) => {
  t.plan(2)

  const stringify = build({
    type: 'object',
    properties: {
      rows: { type: 'array', items: itemSchema },
      total: { type: 'integer' }
    }
  })

  const row = { firstName: 'Matteo', lastName: 'Collina', age: 32 }
  const expectedRow = '{"firstName":"Matteo","lastName":"Collina","age":32}'

  t.assert.equal(stringify({ rows: [row, row], total: 2 }), `{"rows":[${expectedRow},${expectedRow}],"total":2}`)
  // below the projection threshold, so the concatenation path runs instead
  t.assert.equal(stringify({ rows: [row], total: 1 }), `{"rows":[${expectedRow}],"total":1}`)
})

test('null-typed and date/time formatted properties are projected', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        nothing: { type: 'null' },
        day: { type: 'string', format: 'date' },
        clock: { type: 'string', format: 'time' }
      }
    }
  })

  const at = new Date(2020, 0, 2, 3, 4, 5)
  const expected = '{"nothing":null,"day":"2020-01-02","clock":"03:04:05"}'

  t.assert.equal(stringify([{ nothing: null, day: at, clock: at }, { nothing: null, day: at, clock: at }]),
    `[${expected},${expected}]`)
})

test('boolean item schemas decline projection', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: { type: 'array', items: true } } }
  })

  t.assert.equal(stringify([{ a: [1, 'x'] }, { a: [] }]), '[{"a":[1,"x"]},{"a":[]}]')
})

test('a type union without null declines projection', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: { type: ['string', 'integer'] } } }
  })

  t.assert.equal(stringify([{ a: 'x' }, { a: 1 }]), '[{"a":"x"},{"a":1}]')
})

test('objects nested deeper than the projection depth decline', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        l1: {
          type: 'object',
          properties: {
            l2: { type: 'object', properties: { l3: { type: 'object', properties: { v: { type: 'string' } } } } }
          }
        }
      }
    }
  })

  t.assert.equal(stringify([{ l1: { l2: { l3: { v: 'x' } } } }, { l1: { l2: { l3: { v: 'y' } } } }]),
    '[{"l1":{"l2":{"l3":{"v":"x"}}}},{"l1":{"l2":{"l3":{"v":"y"}}}}]')
})

test('a nested array whose items are a $ref declines projection', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'array',
    items: { type: 'object', properties: { a: { type: 'array', items: { $ref: 'item#' } } } }
  }, {
    schema: { item: { type: 'string' } }
  })

  t.assert.equal(stringify([{ a: ['x', 'y'] }, { a: ['z'] }]), '[{"a":["x","y"]},{"a":["z"]}]')
})
