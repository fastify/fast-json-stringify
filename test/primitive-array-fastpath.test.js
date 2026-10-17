'use strict'

const { test } = require('node:test')

const build = require('..')

// The primitive-array fast path (whole-array JSON.stringify behind an
// element guard) must be byte-identical to the per-item serializer for
// every input class. These tests pin the exact bytes and errors for the
// edge inputs where the two mechanisms could diverge.

test('array of numbers: fast path outputs byte-identical JSON', (t) => {
  t.plan(8)
  const stringify = build({ type: 'array', items: { type: 'number' } })

  t.assert.equal(stringify([1, 2, 3]), '[1,2,3]')
  t.assert.equal(stringify([1.5, -1.5, 0.1]), '[1.5,-1.5,0.1]')
  t.assert.equal(stringify([-0]), '[0]')
  t.assert.equal(stringify([Infinity, -Infinity]), '[null,null]')
  t.assert.equal(stringify([1e21, 1e-7, 5e-324]), '[1e+21,1e-7,5e-324]')
  t.assert.equal(stringify([Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER]), '[9007199254740991,-9007199254740991]')
  t.assert.equal(stringify([]), '[]')
  t.assert.equal(stringify(new Array(100).fill(42)), JSON.stringify(new Array(100).fill(42)))
})

test('array of numbers: NaN falls back and throws like the serializer', (t) => {
  t.plan(3)
  const stringify = build({ type: 'array', items: { type: 'number' } })

  t.assert.throws(() => stringify([1, NaN, 3]), /The value "NaN" cannot be converted to a number\./)
  t.assert.throws(() => stringify([1, undefined, 3]), /The value "undefined" cannot be converted to a number\./)
  // holes read as undefined and must throw the same way
  const holey = [1, 2, 3]
  delete holey[1]
  t.assert.throws(() => stringify(holey), /The value "undefined" cannot be converted to a number\./)
})

test('array of numbers: coercible non-numbers fall back to asNumber', (t) => {
  t.plan(5)
  const stringify = build({ type: 'array', items: { type: 'number' } })

  t.assert.equal(stringify(['42']), '[42]')
  t.assert.equal(stringify(['1.5']), '[1.5]')
  t.assert.equal(stringify([null]), '[0]')
  t.assert.equal(stringify([true, false]), '[1,0]')
  t.assert.equal(stringify([10n]), '[10]')
})

test('array of integers: fast path outputs byte-identical JSON', (t) => {
  t.plan(7)
  const stringify = build({ type: 'array', items: { type: 'integer' } })

  t.assert.equal(stringify([1, 2, 3]), '[1,2,3]')
  t.assert.equal(stringify([-0]), '[0]')
  t.assert.equal(stringify([1e21]), '[1e+21]')
  t.assert.equal(stringify([Number.MAX_SAFE_INTEGER]), '[9007199254740991]')
  t.assert.equal(stringify([]), '[]')
  t.assert.equal(stringify(new Array(100).fill(7)), JSON.stringify(new Array(100).fill(7)))
  // bigint items go through asInteger's bigint branch
  t.assert.equal(stringify([10n, 9007199254740993n]), '[10,9007199254740993]')
})

test('array of integers: non-integers fall back and follow rounding', (t) => {
  t.plan(7)
  const stringify = build({ type: 'array', items: { type: 'integer' } })
  const ceilify = build({ type: 'array', items: { type: 'integer' } }, { rounding: 'ceil' })

  t.assert.equal(stringify([1.5]), '[1]')
  t.assert.equal(ceilify([1.5]), '[2]')
  t.assert.equal(stringify([-1.5]), '[-1]')
  t.assert.equal(stringify([1e-7]), '[0]')
  t.assert.equal(ceilify([1e-7]), '[1]')
  t.assert.throws(() => stringify([NaN]), /The value "NaN" cannot be converted to an integer\./)
  t.assert.throws(() => stringify([Infinity]), /The value "Infinity" cannot be converted to an integer\./)
})

test('array of booleans: fast path and fallback', (t) => {
  t.plan(6)
  const stringify = build({ type: 'array', items: { type: 'boolean' } })

  t.assert.equal(stringify([true, false, true]), '[true,false,true]')
  t.assert.equal(stringify([]), '[]')
  t.assert.equal(stringify(new Array(100).fill(true)), JSON.stringify(new Array(100).fill(true)))
  // truthy/falsy non-booleans fall back to asBoolean coercion
  t.assert.equal(stringify([1, 0]), '[true,false]')
  t.assert.equal(stringify([null, undefined]), '[false,false]')
  t.assert.equal(stringify(['x', '']), '[true,false]')
})

test('mixed guard-hit/miss arrays still produce exact baseline output', (t) => {
  t.plan(4)
  const stringify = build({ type: 'array', items: { type: 'number' } })

  // guard breaks at index 1; slow loop must still serialize index 0 the same way
  t.assert.equal(stringify([1, '2', 3]), '[1,2,3]')
  t.assert.equal(stringify([1, 2, '3']), '[1,2,3]')
  // objects with valueOf coerce through asNumber, they do not throw
  t.assert.equal(stringify([1, 2, { valueOf: () => 42 }]), '[1,2,42]')
  t.assert.equal(stringify([{ valueOf: () => 42 }, 2]), '[42,2]')
})

test('objects with toJSON in primitive arrays throw like the baseline', (t) => {
  t.plan(2)
  const numify = build({ type: 'array', items: { type: 'number' } })
  const boolify = build({ type: 'array', items: { type: 'boolean' } })

  t.assert.throws(() => numify([{ toJSON: () => 42 }]), /The value "\[object Object\]" cannot be converted to a number\./)
  // asBoolean coerces via truthiness; an object with toJSON is truthy
  t.assert.equal(boolify([{ toJSON: () => false }]), '[true]')
})

test('nested primitive arrays inside objects use the fast path too', (t) => {
  t.plan(5)
  const stringify = build({
    type: 'object',
    properties: {
      ints: { type: 'array', items: { type: 'integer' } },
      nums: { type: 'array', items: { type: 'number' } },
      bools: { type: 'array', items: { type: 'boolean' } }
    }
  })

  t.assert.equal(
    stringify({ ints: [1, 2], nums: [1.5, Infinity], bools: [true] }),
    '{"ints":[1,2],"nums":[1.5,null],"bools":[true]}'
  )
  t.assert.equal(stringify({ ints: [], nums: [], bools: [] }), '{"ints":[],"nums":[],"bools":[]}')
  t.assert.throws(() => stringify({ nums: [NaN] }), /The value "NaN" cannot be converted to a number\./)
  // 1.5 is not an integer, but trunc-able: falls back and truncates like the baseline
  t.assert.equal(stringify({ ints: [1.5] }), '{"ints":[1]}')
  // missing properties stay omitted; present one keeps fast-path bytes
  t.assert.equal(stringify({ ints: [1, '2'] }), '{"ints":[1,2]}')
})

test('large primitive arrays are byte-identical to JSON.stringify', (t) => {
  t.plan(9)
  const numify = build({ type: 'array', items: { type: 'number' } })
  const integify = build({ type: 'array', items: { type: 'integer' } })
  const boolify = build({ type: 'array', items: { type: 'boolean' } })

  const sizes = [1e3, 2e4, 1e5]
  const nums = []
  const ints = []
  const bools = []
  for (let i = 0; i < 1e5; i++) {
    nums.push(i / 7)
    ints.push(i - 5e4)
    bools.push(i % 2 === 0)
  }
  for (const size of sizes) {
    t.assert.equal(numify(nums.slice(0, size)), JSON.stringify(nums.slice(0, size)))
    t.assert.equal(integify(ints.slice(0, size)), JSON.stringify(ints.slice(0, size)))
    t.assert.equal(boolify(bools.slice(0, size)), JSON.stringify(bools.slice(0, size)))
  }
})

test('largeArrayMechanism json-stringify keeps its own behavior', (t) => {
  t.plan(3)
  const stringify = build({ type: 'array', items: { type: 'number' } }, { largeArrayMechanism: 'json-stringify' })

  // small arrays go through the per-item path and keep coercing
  t.assert.equal(stringify(['42']), '[42]')
  // large arrays are unconditionally natively stringified (documented opt-in trade-off)
  const big = new Array(2e4).fill(1)
  t.assert.equal(stringify(big), JSON.stringify(big))
  t.assert.throws(() => stringify([NaN]), /The value "NaN" cannot be converted to a number\./)
})

test('fast path does not apply to typed arrays (still TypeError)', (t) => {
  t.plan(2)
  const stringify = build({ type: 'array', items: { type: 'number' } })

  t.assert.throws(() => stringify(new Float64Array([1, 2, 3])), /does not match schema definition\./)
  t.assert.throws(() => stringify(new Int32Array([1, 2, 3])), /does not match schema definition\./)
})

test('excluded item schemas keep the classic path', (t) => {
  t.plan(5)
  const nullable = build({ type: 'array', items: { type: 'number', nullable: true } })
  t.assert.equal(nullable([1, null, 2]), '[1,null,2]')

  const typeArray = build({ type: 'array', items: { type: ['number', 'null'] } })
  t.assert.equal(typeArray([1, null, 2]), '[1,null,2]')

  const anyOf = build({ type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'string' }] } })
  t.assert.equal(anyOf([1, 'a']), '[1,"a"]')

  const constItems = build({ type: 'array', items: { type: 'number', const: 42 } })
  t.assert.equal(constItems([42, 42]), '[42,42]')

  const strings = build({ type: 'array', items: { type: 'string' } })
  t.assert.equal(strings(['a', 'b']), '["a","b"]')
})

// The copy-then-stringify path only engages above a per-kind length cutoff
// (Node >= 22: number >= 32, integer >= 512; Node 20: both >= 1e5; boolean
// never). Exercise each kind on both sides of its cutoff with a miss in the
// middle, so the prefix/resume code runs for every kind on every runtime.
test('guard misses above and below each kind cutoff match the serializer', (t) => {
  const cases = [
    ['number', 32, 1.5, '2', 2],
    ['number', 31, 1.5, '2', 2],
    ['integer', 512, 7, 1.5, 1],
    ['integer', 511, 7, 1.5, 1],
    ['integer', 600, 7, 10n, 10],
    ['integer', 99999, 7, 1.5, 1],
    ['integer', 100000, 7, 10n, 10],
    ['number', 100000, 1.5, '2', 2],
    ['boolean', 1000, true, 0, false]
  ]
  t.plan(cases.length * 3)
  for (const [type, length, fill, miss, missOut] of cases) {
    const stringify = build({ type: 'array', items: { type } })
    const clean = new Array(length).fill(fill)
    t.assert.equal(stringify(clean), JSON.stringify(clean), `${type}/${length} clean`)
    const mid = clean.slice()
    mid[length >> 1] = miss
    const expected = clean.slice()
    expected[length >> 1] = missOut
    t.assert.equal(stringify(mid), JSON.stringify(expected), `${type}/${length} mid miss`)
    const last = clean.slice()
    last[length - 1] = miss
    const expectedLast = clean.slice()
    expectedLast[length - 1] = missOut
    t.assert.equal(stringify(last), JSON.stringify(expectedLast), `${type}/${length} last miss`)
  }
})
