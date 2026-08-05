'use strict'

const { test } = require('node:test')
const fs = require('fs')
const os = require('os')
const path = require('path')
const build = require('..')

// https://github.com/fastify/fast-json-stringify/issues/740
// Schema keys containing percent-encoded sequences (e.g. '%3C') are resolved
// literally by fast-json-stringify, but the refs handed to ajv were not
// re-encoded, so ajv percent-decoded them and failed to find the keys.

function buildIssueSchema (composition) {
  return {
    title: 'object with $ref',
    definitions: {
      'Some%3Cloremipsum%3E': {
        additionalProperties: composition,
        type: 'object'
      }
    },
    type: 'object',
    properties: {
      obj: {
        $ref: '#/definitions/Some%3Cloremipsum%3E'
      }
    }
  }
}

const oneOfComposition = {
  oneOf: [
    { type: 'string' },
    { type: 'number' },
    { type: 'object' },
    { type: 'null' }
  ]
}

test('ref to a percent-encoded definition key with oneOf', (t) => {
  t.plan(1)

  const stringify = build(buildIssueSchema(oneOfComposition))
  const output = stringify({ obj: { str: 'test' } })

  t.assert.equal(output, '{"obj":{"str":"test"}}')
})

test('ref to a percent-encoded definition key with anyOf', (t) => {
  t.plan(1)

  const stringify = build(buildIssueSchema({
    anyOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  }))
  const output = stringify({ obj: { str: 'test' } })

  t.assert.equal(output, '{"obj":{"str":"test"}}')
})

test('ref to a percent-encoded definition key with if/then/else', (t) => {
  t.plan(2)

  const stringify = build({
    definitions: {
      'Some%3Cloremipsum%3E': {
        type: 'object',
        properties: { kind: { type: 'string' } },
        if: { type: 'object', properties: { kind: { const: 'a' } } },
        then: { type: 'object', properties: { kind: { type: 'string' }, a: { type: 'string' } } },
        else: { type: 'object', properties: { kind: { type: 'string' }, b: { type: 'string' } } }
      }
    },
    type: 'object',
    properties: {
      obj: { $ref: '#/definitions/Some%3Cloremipsum%3E' }
    }
  })

  t.assert.equal(stringify({ obj: { kind: 'a', a: 'x' } }), '{"obj":{"kind":"a","a":"x"}}')
  t.assert.equal(stringify({ obj: { kind: 'c', b: 'y' } }), '{"obj":{"kind":"c","b":"y"}}')
})

test('property name containing a percent character with oneOf', (t) => {
  t.plan(2)

  const stringify = build({
    type: 'object',
    properties: {
      'weird%name': {
        oneOf: [
          { type: 'string' },
          { type: 'number' }
        ]
      }
    }
  })

  t.assert.equal(stringify({ 'weird%name': 'value' }), '{"weird%name":"value"}')
  t.assert.equal(stringify({ 'weird%name': 42 }), '{"weird%name":42}')
})

test('ref to a percent-encoded definition key with oneOf in standalone mode', async (t) => {
  t.plan(1)

  const code = build(buildIssueSchema(oneOfComposition), { mode: 'standalone' })

  // The standalone output does `require('fast-json-stringify/lib/...')`, so the
  // generated file must live where that package resolves. Use a per-run temp
  // dir and link node_modules into it so nothing is written into the repo tree.
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fjs-issue-740-'))

  t.after(async () => {
    await fs.promises.rm(dir, { recursive: true, force: true })
  })

  await fs.promises.symlink(path.resolve(__dirname, '..', 'node_modules'), path.join(dir, 'node_modules'), 'junction')
  const destination = path.join(dir, 'standalone-issue-740.js')

  await fs.promises.writeFile(destination, code)
  const standalone = require(destination)

  t.assert.equal(standalone({ obj: { str: 'test' } }), '{"obj":{"str":"test"}}')
})
