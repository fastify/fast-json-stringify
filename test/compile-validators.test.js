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
  return [...code.matchAll(/validator\.getSchemaValidator\("([^"]+)"/g)].map(match => match[1])
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

test('each schema is looked up once, on first use, not on every serialization', t => {
  t.plan(5)

  const debug = fjs(schema, { mode: 'debug' })
  const { ajv } = debug
  const refs = getValidatorRefs(debug.code)

  const lookups = []
  const getSchema = ajv.getSchema
  ajv.getSchema = function (ref) {
    lookups.push(ref)
    return getSchema.call(this, ref)
  }

  const stringify = fjs.restore(debug)
  t.assert.deepStrictEqual(lookups, [], 'nothing is looked up at build time')

  // only the first anyOf branch is needed for a string
  t.assert.equal(stringify({ union: 'foo' }), '{"union":"foo"}')
  t.assert.deepStrictEqual(lookups, [refs[0]])

  const input = { union: 42, choice: { b: 42 }, conditional: 'bar' }
  const expected = '{"union":42,"choice":{"b":42},"conditional":"bar"}'
  for (let i = 0; i < 10; i++) stringify(input)
  t.assert.equal(stringify(input), expected)
  t.assert.deepStrictEqual([...lookups].sort(), [...refs].sort(), 'one lookup per schema after eleven serializations')
})

test('a schema validated in several places is looked up through one variable', t => {
  t.plan(3)

  const shared = {
    type: 'object',
    definitions: {
      value: { anyOf: [{ type: 'string' }, { type: 'number' }] }
    },
    properties: {
      a: { $ref: '#/definitions/value' },
      b: { $ref: '#/definitions/value' }
    }
  }

  const { code } = fjs(shared, { mode: 'debug' })
  const refs = getValidatorRefs(code)

  t.assert.equal(refs.length, 4, 'two anyOf branches, used by two properties')
  t.assert.equal(new Set(refs).size, 2)
  t.assert.equal(code.match(/^\s*let validate_\d+$/gm).length, 2)
})

test('getSchemaValidator throws on a ref that is not registered, like validate', t => {
  t.plan(2)

  const { validator } = fjs(schema, { mode: 'debug' })

  t.assert.throws(() => validator.getSchemaValidator('missing#'), /no schema with key or ref "missing#"/)
  t.assert.throws(() => validator.validate('missing#', 1), /no schema with key or ref "missing#"/)
})
