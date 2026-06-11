'use strict'

const { test, after } = require('node:test')
const fs = require('fs')
const path = require('path')
const build = require('..')

process.env.TZ = 'UTC'

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

  const destination = path.resolve('test/fixtures', 'standalone-issue-740.js')

  after(async () => {
    await fs.promises.rm(destination, { force: true })
  })

  await fs.promises.writeFile(destination, code)
  const standalone = require(destination)

  t.assert.equal(standalone({ obj: { str: 'test' } }), '{"obj":{"str":"test"}}')
})
