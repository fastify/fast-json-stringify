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

  const destionation = path.resolve(tmpDir, 'standalone.js')

  t.teardown(async () => {
    await fs.promises.rm(destionation, { force: true })
  })

  await fs.promises.writeFile(destionation, code)
  const standalone = require(destionation)
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

  const destionation = path.resolve(tmpDir, 'standalone2.js')

  t.teardown(async () => {
    await fs.promises.rm(destionation, { force: true })
  })

  await fs.promises.writeFile(destionation, code)
  const standalone = require(destionation)
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
