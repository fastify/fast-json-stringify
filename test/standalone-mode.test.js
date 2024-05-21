'use strict'

const test = require('tap').test
const fjs = require('..')
const fs = require('fs')
const path = require('path')

function build (opts, schema) {
  return fjs(schema || {
    title: 'default string',
    type: 'object',
    properties: {
      firstName: {
        type: 'string'
      }
    },
    required: ['firstName']
  }, opts)
}

const tmpDir = 'test/fixtures'

test('activate standalone mode', async (t) => {
  t.plan(3)
  const code = build({ mode: 'standalone' })
  t.type(code, 'string')
  t.equal(code.indexOf('ajv'), -1)

  const destination = path.resolve(tmpDir, 'standalone.js')

  t.teardown(async () => {
    await fs.promises.rm(destination, { force: true })
  })

  await fs.promises.writeFile(destination, code)
  const standalone = require(destination)
  t.same(standalone({ firstName: 'Foo', surname: 'bar' }), JSON.stringify({ firstName: 'Foo' }), 'surname evicted')
})

test('test ajv schema', async (t) => {
  t.plan(3)
  const code = build({ mode: 'standalone' }, {
    type: 'object',
    properties: {
    },
    if: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['foobar'] }
      }
    },
    then: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['foobar'] },
        foo: { type: 'string' },
        bar: { type: 'number' },
        list: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          }
        }
      }
    },
    else: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['greeting'] },
        hi: { type: 'string' },
        hello: { type: 'number' },
        list: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' }
            }
          }
        }
      }
    }
  })
  t.type(code, 'string')
  t.equal(code.indexOf('ajv') > 0, true)

  const destination = path.resolve(tmpDir, 'standalone2.js')

  t.teardown(async () => {
    await fs.promises.rm(destination, { force: true })
  })

  await fs.promises.writeFile(destination, code)
  const standalone = require(destination)
  t.same(standalone({
    kind: 'foobar',
    foo: 'FOO',
    list: [{
      name: 'name',
      value: 'foo'
    }],
    bar: 42,
    hi: 'HI',
    hello: 45,
    a: 'A',
    b: 35
  }), JSON.stringify({
    kind: 'foobar',
    foo: 'FOO',
    bar: 42,
    list: [{
      name: 'name',
      value: 'foo'
    }]
  }))
})

test('no need to keep external schemas once compiled', async (t) => {
  t.plan(1)
  const externalSchema = {
    first: {
      definitions: {
        id1: {
          type: 'object',
          properties: {
            id1: {
              type: 'integer'
            }
          }
        }
      }
    }
  }
  const code = fjs({
    $ref: 'first#/definitions/id1'
  }, {
    mode: 'standalone',
    schema: externalSchema
  })

  const destination = path.resolve(tmpDir, 'standalone3.js')

  t.teardown(async () => {
    await fs.promises.rm(destination, { force: true })
  })

  await fs.promises.writeFile(destination, code)
  const standalone = require(destination)

  t.same(standalone({ id1: 5 }), JSON.stringify({ id1: 5 }), 'serialization works with external schemas')
})

test('no need to keep external schemas once compiled - with oneOf validator', async (t) => {
  t.plan(2)

  const externalSchema = {
    ext: {
      definitions: {
        oBaz: {
          type: 'object',
          properties: {
            baz: { type: 'number' }
          },
          required: ['baz']
        },
        oBar: {
          type: 'object',
          properties: {
            bar: { type: 'string' }
          },
          required: ['bar']
        },
        other: {
          type: 'string',
          const: 'other'
        }
      }
    }
  }

  const schema = {
    title: 'object with oneOf property value containing refs to external schema',
    type: 'object',
    properties: {
      oneOfSchema: {
        oneOf: [
          { $ref: 'ext#/definitions/oBaz' },
          { $ref: 'ext#/definitions/oBar' }
        ]
      }
    },
    required: ['oneOfSchema']
  }

  const code = fjs(schema, {
    mode: 'standalone',
    schema: externalSchema
  })

  const destination = path.resolve(tmpDir, 'standalone-oneOf-ref.js')

  t.teardown(async () => {
    await fs.promises.rm(destination, { force: true })
  })

  await fs.promises.writeFile(destination, code)
  const stringify = require(destination)

  t.equal(stringify({ oneOfSchema: { baz: 5 } }), '{"oneOfSchema":{"baz":5}}')
  t.equal(stringify({ oneOfSchema: { bar: 'foo' } }), '{"oneOfSchema":{"bar":"foo"}}')
})
