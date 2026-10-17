'use strict'

const { test } = require('node:test')
const build = require('..')

for (const type of ['string', 'number', 'integer', 'boolean']) {
  const item = type === 'string' ? 'first' : type === 'boolean' ? true : 1
  const later = type === 'string' ? 'later' : type === 'boolean' ? false : 2
  const schema = { type: 'array', items: { type } }
  const stringify = build(schema, { largeArraySize: 1 })

  test(`${type} fast path reads getters once and ignores source toJSON`, t => {
    let reads = 0
    const input = new Array(32).fill(item)
    Object.defineProperty(input, 0, { get () { return reads++ === 0 ? item : later } })
    input.toJSON = () => ['wrong']
    t.assert.equal(stringify(input), JSON.stringify(new Array(32).fill(item)))
    t.assert.equal(reads, 1)
  })

  test(`${type} fast path miss retains the captured prefix`, t => {
    let reads = 0
    const input = [item, null, ...new Array(30).fill(item)]
    Object.defineProperty(input, 0, { get () { return reads++ === 0 ? item : later } })
    const coercedNull = type === 'string' ? '' : type === 'boolean' ? false : 0
    t.assert.equal(stringify(input), JSON.stringify([item, coercedNull, ...new Array(30).fill(item)]))
    t.assert.equal(reads, 1)
  })

  test(`${type} fast path ignores inherited array toJSON`, t => {
    const previous = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON')
    let output
    try {
      // eslint-disable-next-line no-extend-native -- Deliberate user-data hook.
      Object.defineProperty(Array.prototype, 'toJSON', {
        configurable: true,
        get () { throw new Error('array toJSON must not be read') }
      })
      output = stringify(new Array(32).fill(item))
    } finally {
      // eslint-disable-next-line no-extend-native -- Restore the original descriptor.
      if (previous) Object.defineProperty(Array.prototype, 'toJSON', previous)
      else delete Array.prototype.toJSON
    }
    t.assert.equal(output, JSON.stringify(new Array(32).fill(item)))
  })

  test(`${type} arrays read proxy length once without extra coercion`, t => {
    let lengths = 0
    let coercions = 0
    const input = new Proxy([item, item, item, item], {
      get (target, key) {
        if (key === 'length') {
          lengths++
          return { valueOf () { return ++coercions < 3 ? 4 : 2 } }
        }
        return target[key]
      }
    })
    t.assert.equal(stringify(input), JSON.stringify([item, item]))
    t.assert.equal(lengths, 1)
    t.assert.equal(coercions, 3)
  })

  test(`${type} arrays preserve numeric proxy lengths`, t => {
    for (const length of [-1, NaN, 0, 1.5, 2]) {
      let reads = 0
      const input = new Proxy([item, item], {
        get (target, key) {
          if (key === 'length') { reads++; return length }
          return target[key]
        }
      })
      t.assert.equal(stringify(input), JSON.stringify(length > 0 ? [item, item] : []))
      t.assert.equal(reads, 1)
    }
  })

  test(`${type} arrays work in standalone mode with source hooks`, t => {
    const source = build(schema, { mode: 'standalone', largeArraySize: 1 })
    const module = { exports: {} }
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', source)(require, module)
    const input = [item, null, ...new Array(30).fill(item)]
    input.toJSON = () => ['wrong']
    t.assert.equal(module.exports(input), stringify(input))
  })
}

for (const type of ['string', 'number', 'integer']) {
  test(`${type} fallback coerces the first miss before reading the next item`, t => {
    const events = []
    const input = [type === 'string' ? '1' : 1, {
      toString () { events.push('coerce'); input[2] = 7; return '2' },
      valueOf () { events.push('coerce'); input[2] = 7; return 2 }
    }, ...new Array(30).fill(3)]
    const proxy = new Proxy(input, {
      get (target, key) { events.push(key); return target[key] }
    })
    const stringify = build({ type: 'array', items: { type } }, { largeArraySize: 1 })
    const expected = [1, 2, 7, ...new Array(29).fill(3)]
    t.assert.equal(stringify(proxy), JSON.stringify(type === 'string' ? expected.map(String) : expected))
    t.assert.deepEqual(events, ['length', '0', '1', 'coerce', ...Array.from({ length: 30 }, (_, i) => String(i + 2))])
  })
}

test('fast paths stop before later getters when coercion throws', t => {
  for (const type of ['string', 'number', 'integer']) {
    let reads = 0
    const input = [type === 'string' ? '1' : 1, undefined, ...new Array(30).fill(3)]
    Object.defineProperty(input, 2, { get () { reads++; return 3 } })
    const stringify = build({ type: 'array', items: { type } }, { largeArraySize: 1 })
    t.assert.throws(() => stringify(input))
    t.assert.equal(reads, 0)
  }
})
