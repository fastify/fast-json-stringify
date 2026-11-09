'use strict'

const { test } = require('node:test')
const build = require('..')

// The copy-then-JSON.stringify fast path for primitive arrays must produce the
// same output whether or not Array.prototype.toJSON has been patched, and must
// never invoke such a hook.

const numbers = Array.from({ length: 1000 }, (_, i) => i * 1.37)
const integers = Array.from({ length: 1000 }, (_, i) => i)
const strings = Array.from({ length: 1000 }, (_, i) => 'item-' + i)

const cases = [
  ['number', { type: 'array', items: { type: 'number' } }, numbers, {}],
  ['integer', { type: 'array', items: { type: 'integer' } }, integers, {}],
  ['string', { type: 'array', items: { type: 'string' } }, strings, { largeArraySize: 100 }]
]

for (const [name, schema, data, options] of cases) {
  test(`${name} array fast path with pristine Array.prototype`, t => {
    t.plan(2)
    t.assert.equal(Array.prototype.toJSON, undefined)
    const stringify = build(schema, options)
    t.assert.equal(stringify(data), JSON.stringify(data))
  })

  test(`${name} array fast path ignores a patched Array.prototype.toJSON`, t => {
    t.plan(2)
    const expected = JSON.stringify(data)
    let called = 0
    // eslint-disable-next-line no-extend-native
    Array.prototype.toJSON = function () { called++; return 'hooked' }
    t.after(() => { delete Array.prototype.toJSON })
    const stringify = build(schema, options)
    t.assert.equal(stringify(data), expected)
    t.assert.equal(called, 0)
  })

  test(`${name} array fast path resumes per-item coercion after a miss, with patched toJSON`, t => {
    t.plan(1)
    const mixed = data.slice()
    mixed[500] = name === 'string' ? 42 : '7'
    const stringify = build(schema, options)
    const expected = stringify(mixed)
    // eslint-disable-next-line no-extend-native
    Array.prototype.toJSON = function () { return 'hooked' }
    t.after(() => { delete Array.prototype.toJSON })
    t.assert.equal(build(schema, options)(mixed), expected)
  })
}
