'use strict'

const arrayKinds = ['integer', 'number', 'short-string', 'long-string', 'flat-object', 'nested-object', 'nullable-number', 'Float64Array', 'Int32Array']
const arraySizes = [1e3, 2e4, 1e5, 1e6]
const mechanisms = ['default', 'json-stringify', 'native']
const flatSchema = { type: 'object', properties: { s: { type: 'string' }, n: { type: 'number' }, b: { type: 'boolean' } } }
const longString = 'a"quoted" string\\with\ncontrols '.repeat(4)

function arrayFixture (kind, size) {
  let items
  let value
  switch (kind) {
    case 'integer':
    case 'Int32Array':
      items = { type: 'integer' }
      value = i => (i % 2001) - 1000
      break
    case 'number':
    case 'Float64Array':
      items = { type: 'number' }
      value = i => ((i % 2001) - 1000) / 10
      break
    case 'short-string':
      items = { type: 'string' }
      value = i => `hello ${i % 100}`
      break
    case 'long-string':
      items = { type: 'string' }
      value = () => longString
      break
    case 'flat-object':
      items = flatSchema
      value = i => ({ s: `hello ${i % 100}`, n: i % 1000, b: i % 2 === 0 })
      break
    case 'nested-object':
      items = { type: 'object', properties: { id: { type: 'integer' }, inner: { type: 'array', items: flatSchema } } }
      value = i => ({ id: i, inner: [{ s: 'hello', n: i % 1000, b: true }, { s: 'world', n: i / 10, b: false }] })
      break
    case 'nullable-number':
      items = { type: 'number', nullable: true }
      value = i => i % 4 === 0 ? null : i / 10
      break
    default:
      throw new Error(`Unknown array kind: ${kind}`)
  }
  const input = kind === 'Float64Array'
    ? Float64Array.from({ length: size }, (_, i) => value(i))
    : kind === 'Int32Array'
      ? Int32Array.from({ length: size }, (_, i) => value(i))
      : Array.from({ length: size }, (_, i) => value(i))
  return { schema: { type: 'array', items }, input, typed: ArrayBuffer.isView(input) }
}

module.exports = { arrayKinds, arraySizes, mechanisms, arrayFixture }
