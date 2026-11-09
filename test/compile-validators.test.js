'use strict'

const { test } = require('node:test')
const fjs = require('..')

const schema = {
  title: 'compile validators',
  type: 'object',
  properties: {
    union: {
      anyOf: [
        { type: 'string' },
        { type: 'number' }
      ]
    },
    choice: {
      oneOf: [
        { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
        { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] }
      ]
    },
    conditional: {
      if: { type: 'string' },
      then: { type: 'string' },
      else: { type: 'number' }
    }
  }
}

// The refs the generated code validates against, straight out of the emitted
// source, so the assertions cannot drift from what fjs actually calls.
function getValidatorRefs (code) {
  return [...code.matchAll(/validator\.validate\("([^"]+)"/g)].map(match => match[1])
}

// Ajv stores a compiled schema as a SchemaEnv with a `validate` function.
// `getSchema()` is not used here because it compiles on demand, which is the
// very thing under test.
function isCompiled (ajv, ref) {
  const schemaEnv = ajv.refs[ref] || ajv.schemas[ref]
  return schemaEnv !== undefined && typeof schemaEnv.validate === 'function'
}

test('validators are compiled lazily by default', t => {
  t.plan(2)

  const { code, ajv } = fjs(schema, { mode: 'debug' })
  const refs = getValidatorRefs(code)

  t.assert.ok(refs.length > 0)
  t.assert.deepStrictEqual(refs.filter(ref => isCompiled(ajv, ref)), [])
})

test('compileValidators compiles every validator used by the generated code', t => {
  t.plan(2)

  const { code, ajv } = fjs(schema, { mode: 'debug', compileValidators: true })
  const refs = getValidatorRefs(code)

  t.assert.ok(refs.length > 0)
  t.assert.deepStrictEqual(refs.filter(ref => !isCompiled(ajv, ref)), [])
})

test('compileValidators does not change the serialization output', t => {
  t.plan(2)

  const input = {
    union: 'foo',
    choice: { b: 42 },
    conditional: 'bar'
  }
  const expected = JSON.stringify({ union: 'foo', choice: { b: 42 }, conditional: 'bar' })

  t.assert.equal(fjs(schema)(input), expected)
  t.assert.equal(fjs(schema, { compileValidators: true })(input), expected)
})

test('compileValidators works with external schemas resolved after registration', t => {
  t.plan(3)

  const externalSchema = {
    branch: {
      $id: 'branch',
      definitions: {
        str: { type: 'string' },
        num: { type: 'number' }
      },
      type: 'object',
      properties: {
        value: {
          anyOf: [
            { $ref: 'branch#/definitions/str' },
            { $ref: 'branch#/definitions/num' }
          ]
        }
      }
    }
  }

  const rootSchema = { $ref: 'branch#' }
  const options = { schema: externalSchema, compileValidators: true }

  const { code, ajv } = fjs(rootSchema, { ...options, mode: 'debug' })
  const refs = getValidatorRefs(code)

  t.assert.ok(refs.length > 0)
  t.assert.deepStrictEqual(refs.filter(ref => !isCompiled(ajv, ref)), [])

  t.assert.equal(fjs(rootSchema, options)({ value: 7 }), JSON.stringify({ value: 7 }))
})
