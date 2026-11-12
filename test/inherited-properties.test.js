'use strict'

const { test } = require('node:test')
const build = require('..')

function compile (schema, mode) {
  if (mode === 'native') return build(schema, { objectMechanism: 'native', forceProjection: true })
  if (mode === 'standalone') {
    const output = { exports: {} }
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', build(schema, { mode: 'standalone' }))(require, output)
    return output.exports
  }
  return build(schema)
}

for (const mode of ['normal', 'standalone', 'native']) {
  test(`missing optional properties do not read the prototype: ${mode}`, t => {
    const stringify = compile({
      type: 'object',
      properties: {
        valueOf: { type: 'boolean' },
        constructor: { type: 'string' },
        toString: { type: 'integer' },
        label: { type: 'string' }
      }
    }, mode)

    t.assert.equal(stringify({}), '{}')
    t.assert.equal(stringify({ label: 'own' }), '{"label":"own"}')
    t.assert.equal(stringify({ valueOf: false, constructor: 'own', toString: 3 }), '{"valueOf":false,"constructor":"own","toString":3}')

    class Item { constructor () { this.label = 'item' } }
    t.assert.equal(stringify(new Item()), '{"label":"item"}')

    const parent = { label: 'inherited' }
    const input = Object.create(parent)
    t.assert.equal(stringify(input), '{}')
    input.label = 'own'
    t.assert.equal(stringify(input), '{"label":"own"}')
    t.assert.equal(stringify(Object.assign(Object.create(null), { label: 'null prototype' })), '{"label":"null prototype"}')

    let inheritedReads = 0
    const withGetter = Object.create({ get label () { inheritedReads++; return 'inherited' } })
    t.assert.equal(stringify(withGetter), '{}')
    t.assert.equal(inheritedReads, 0)
  })

  test(`inherited properties use defaults or fail required checks: ${mode}`, t => {
    const optional = compile({
      type: 'object',
      properties: { label: { type: 'string', default: 'default' } }
    }, mode)
    t.assert.equal(optional(Object.create({ label: 'inherited' })), '{"label":"default"}')
    t.assert.equal(optional({ label: undefined }), '{"label":"default"}')

    const required = compile({
      type: 'object',
      required: ['label'],
      properties: { label: { type: 'string' } }
    }, mode)
    t.assert.throws(() => required(Object.create({ label: 'inherited' })), /"label" is required!/)
    t.assert.equal(required({ label: 'own' }), '{"label":"own"}')

    const nested = compile({
      type: 'object',
      properties: { item: { type: 'object', properties: { label: { type: 'string' } } } }
    }, mode)
    t.assert.equal(nested({ item: Object.create({ label: 'inherited' }) }), '{"item":{}}')
    t.assert.equal(nested({ item: { toJSON () { return Object.create({ label: 'inherited' }) } } }), '{"item":{}}')

    const items = compile({
      type: 'array',
      items: { type: 'object', properties: { label: { type: 'string' } } }
    }, mode)
    t.assert.equal(items([Object.create({ label: 'inherited' }), { label: 'own' }]), '[{},{"label":"own"}]')

    // A required field need not also appear under properties.
    const undeclaredRequired = compile({ type: 'object', required: ['label'] }, mode)
    t.assert.throws(() => undeclaredRequired(Object.create({ label: 'inherited' })), /"label" is required!/)
    t.assert.equal(undeclaredRequired({ label: 'own' }), '{}')
  })
}
