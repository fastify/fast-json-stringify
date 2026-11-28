'use strict'

const { test } = require('node:test')

// objectMechanism: 'native' is a no-op on runtimes without the V8 JSON.stringify
// fast path (Node < 25).
const build = require('..')

const schema = { type: 'object', properties: { a: { type: 'string' }, n: { type: 'number' } } }
const nodeMajor = Number.parseInt(process.versions.node, 10)

test('native mechanism is enabled only on Node 25+', t => {
  t.plan(2)
  const code = build(schema, { objectMechanism: 'native', mode: 'debug' }).code
  t.assert.equal(code.includes('asStringValue'), nodeMajor >= 25)
  // whatever the runtime, output is the same as the default mechanism
  t.assert.equal(build(schema, { objectMechanism: 'native' })({ a: 'x', n: 1, extra: true }), build(schema)({ a: 'x', n: 1, extra: true }))
})
