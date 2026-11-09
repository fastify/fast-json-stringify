'use strict'

const { test } = require('node:test')
const build = require('..')

// Properties named after Object.prototype members must only be read when the
// input owns them; otherwise `{}` would serialize `toString`, `constructor`
// and friends, and a `valueOf: integer` schema would throw on an empty object.
const schema = JSON.parse(JSON.stringify({
  type: 'object',
  properties: {
    constructor: { type: 'boolean' },
    toString: { type: 'string' },
    hasOwnProperty: { type: 'string' },
    valueOf: { type: 'integer' },
    isPrototypeOf: { type: 'number' },
    x: { type: 'integer' }
  }
}))
// an own "__proto__" property has to be added without touching the prototype
Object.defineProperty(schema.properties, '__proto__', {
  value: { type: 'object', properties: { a: { type: 'integer' } } },
  enumerable: true
})

const ownValues = JSON.parse('{"constructor":false,"toString":"t","hasOwnProperty":"h","valueOf":3,"isPrototypeOf":1.5,"__proto__":{"a":1},"x":1}')

for (const options of [{}, { objectMechanism: 'native' }]) {
  const label = JSON.stringify(options)

  test(`inherited Object.prototype members are not serialized: ${label}`, t => {
    const stringify = build(schema, options)
    t.assert.equal(stringify({}), '{}')
    t.assert.equal(stringify({ x: 1 }), '{"x":1}')
    t.assert.equal(stringify(Object.create(null)), '{}')
  })

  test(`own properties with Object.prototype names are serialized: ${label}`, t => {
    const stringify = build(schema, options)
    // properties are emitted in schema order, so compare the parsed documents
    t.assert.deepStrictEqual(JSON.parse(stringify(ownValues)), ownValues)
  })

  test(`own properties with Object.prototype names satisfy required: ${label}`, t => {
    const stringify = build({ ...schema, required: ['constructor', 'valueOf'] }, options)
    t.assert.deepStrictEqual(JSON.parse(stringify(ownValues)), ownValues)
    t.assert.throws(() => stringify({ x: 1 }), /is required!/)
  })

  test(`getters on a prototype are still read: ${label}`, t => {
    class Foo { get id () { return 7 } }
    const stringify = build({ type: 'object', properties: { id: { type: 'integer' } } }, options)
    t.assert.equal(stringify(new Foo()), '{"id":7}')
  })
}

test('inherited Object.prototype members are not serialized in standalone mode', t => {
  const output = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', build(schema, { mode: 'standalone' }))(require, output)
  t.assert.equal(output.exports({}), '{}')
  t.assert.deepStrictEqual(JSON.parse(output.exports(ownValues)), ownValues)
})
