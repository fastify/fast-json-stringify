'use strict'

const { test } = require('node:test')
const build = require('..')

function compile (schema, mode) {
  if (mode === 'normal') return build(schema)
  const output = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', build(schema, { mode: 'standalone' }))(require, output)
  return output.exports
}

for (const mode of ['normal', 'standalone']) {
  test('optional property prefixes preserve omissions and escaped keys: ' + mode, t => {
    const keys = ['first', 'quote"', 'back\\slash', 'line\nbreak']
    const properties = Object.fromEntries(keys.map(key => [key, { type: 'integer' }]))
    const stringify = compile({ type: 'object', properties, additionalProperties: false }, mode)

    for (let mask = 0; mask < 16; mask++) {
      const input = { ignored: true }
      const expected = {}
      for (let i = keys.length - 1; i >= 0; i--) {
        input[keys[i]] = mask & (1 << i) ? i : undefined
      }
      for (let i = 0; i < keys.length; i++) {
        if (mask & (1 << i)) expected[keys[i]] = i
      }
      t.assert.equal(stringify(input), JSON.stringify(expected))
    }
  })

  test('optional property prefixes share comma state with defaults and extra properties: ' + mode, t => {
    const stringify = compile({
      type: 'object',
      properties: {
        first: { type: 'string' },
        middle: { type: 'string', default: 'fallback' },
        last: { type: 'boolean' }
      },
      patternProperties: { '^x': { type: 'integer' } },
      additionalProperties: { type: 'string' }
    }, mode)

    t.assert.equal(stringify({}), '{"middle":"fallback"}')
    t.assert.equal(stringify({ first: 'a', last: false, x: 2, extra: 'b' }), '{"first":"a","middle":"fallback","last":false,"x":2,"extra":"b"}')
    t.assert.equal(stringify({ middle: 'b', extra: 'c' }), '{"middle":"b","extra":"c"}')

    const noDefaults = compile({
      type: 'object',
      properties: { first: { type: 'string' } },
      additionalProperties: true
    }, mode)
    t.assert.equal(noDefaults({ extra: 1 }), '{"extra":1}')
    t.assert.equal(noDefaults({ first: 'a', extra: 1 }), '{"first":"a","extra":1}')
  })

  test('optional property prefixes reset for nested objects and array items: ' + mode, t => {
    const item = {
      type: 'object',
      properties: { first: { type: 'integer' }, last: { type: 'integer' } }
    }
    const stringify = compile({
      type: 'object',
      properties: {
        before: item,
        items: { type: 'array', items: item },
        after: item
      }
    }, mode)
    const input = {
      before: {},
      items: [{ last: 1 }, {}, { first: 2, last: 3 }, { first: 4 }],
      after: { last: 5 }
    }
    t.assert.equal(stringify(input), JSON.stringify(input))
    t.assert.equal(stringify({ after: { first: 6 } }), '{"after":{"first":6}}')
  })

  test('optional property prefixes preserve getter and coercion order: ' + mode, t => {
    const stringify = compile({
      type: 'object',
      properties: {
        first: { type: 'string' },
        second: { type: 'integer' },
        last: { type: 'boolean' }
      }
    }, mode)
    const events = []
    const failure = new Error('coercion failed')
    let fail = false
    const input = {
      get first () {
        events.push('first')
        return {
          toString () {
            events.push('coerce first')
            if (fail) throw failure
            return 'a'
          }
        }
      },
      get second () {
        events.push('second')
        return 2
      },
      get last () {
        events.push('last')
        return undefined
      }
    }
    t.assert.equal(stringify(input), '{"first":"a","second":2}')
    t.assert.deepStrictEqual(events, ['first', 'coerce first', 'second', 'last'])
    events.length = 0
    fail = true
    t.assert.throws(() => stringify(input), error => error === failure)
    t.assert.deepStrictEqual(events, ['first', 'coerce first'])
  })
}
