'use strict'

const { test } = require('node:test')
const build = require('..')

// Plain string arrays use their own copy-then-JSON.stringify cutoff, independent
// of largeArraySize (which only drives largeArrayMechanism: 'json-stringify').
const nodeMajor = Number.parseInt(process.versions.node, 10)
const CUTOFF = nodeMajor >= 22 ? 8 : 128

const schema = { type: 'array', items: { type: 'string' } }
const nested = { type: 'object', properties: { tags: schema } }
const strings = (n) => Array.from({ length: n }, (_, i) => 'item-' + i)

test('string array cutoff does not depend on largeArraySize', t => {
  t.plan(2)
  const code = build(schema, { mode: 'debug', largeArraySize: 5000 }).code
  t.assert.ok(code.includes(`arrayLength >= ${CUTOFF} `), 'uses the string cutoff')
  t.assert.ok(!code.includes('arrayLength >= 5000'), 'ignores largeArraySize')
})

test('string arrays at and above the cutoff are byte-identical to JSON.stringify', t => {
  const stringify = build(schema)
  const lengths = [CUTOFF - 1, CUTOFF, CUTOFF + 1, CUTOFF * 10]
  t.plan(lengths.length)
  for (const n of lengths) {
    t.assert.equal(stringify(strings(n)), JSON.stringify(strings(n)))
  }
})

test('nested string arrays use the same cutoff', t => {
  t.plan(2)
  const code = build(nested, { mode: 'debug', largeArraySize: 5000 }).code
  t.assert.ok(code.includes(`>= ${CUTOFF} `))
  t.assert.equal(build(nested)({ tags: strings(CUTOFF) }), JSON.stringify({ tags: strings(CUTOFF) }))
})

test('escapes and non-string elements above the cutoff keep per-element semantics', t => {
  t.plan(4)
  const stringify = build(schema)
  const withEscapes = strings(CUTOFF).map((s, i) => i % 2 ? s + '"\n\u0000' : s)
  t.assert.equal(stringify(withEscapes), JSON.stringify(withEscapes))
  const mixed = strings(CUTOFF)
  mixed[1] = 42
  mixed[2] = null
  // asString semantics: non-strings are coerced via toString, null becomes ""
  t.assert.equal(stringify(mixed), JSON.stringify(mixed.map((v) => v === null ? '' : String(v))))
  const dates = strings(CUTOFF)
  dates[0] = new Date(0)
  t.assert.equal(stringify(dates), JSON.stringify(dates.map((v) => v instanceof Date ? v.toISOString() : v)))
  const regexps = strings(CUTOFF)
  regexps[3] = /a"b/
  regexps[5] = /c/g
  t.assert.equal(stringify(regexps), JSON.stringify(regexps.map((v) => v instanceof RegExp ? v.source : v)))
})

test('largeArraySize still drives the json-stringify mechanism for strings', t => {
  t.plan(2)
  const code = build(schema, { mode: 'debug', largeArrayMechanism: 'json-stringify', largeArraySize: 5000 }).code
  t.assert.ok(code.includes('arrayLength >= 5000'))
  t.assert.ok(!code.includes('asPlainStringArray(obj'))
})
