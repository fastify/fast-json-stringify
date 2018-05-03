'use strict'

const t = require('tap')
const build = require('..')

const schema = {
  'type': 'object',
  'properties': {
    'kind': { 'type': 'string', 'enum': ['foobar', 'greeting'] }
  },
  'if': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar'] }
    }
  },
  'then': {
    'properties': {
      'foo': { 'type': 'string' },
      'bar': { 'type': 'number' }
    }
  },
  'else': {
    'properties': {
      'hi': { 'type': 'string' },
      'hello': { 'type': 'number' }
    }
  }
}

t.test('if-then-else', t => {
  const tests = [
    {
      name: 'foobar',
      schema: schema,
      input: {
        kind: 'foobar',
        foo: 'FOO',
        bar: 42,
        hi: 'HI',
        hello: 'HELLO'
      },
      expected: JSON.stringify({
        kind: 'foobar',
        foo: 'FOO',
        bar: 42
      })
    },
    {
      name: 'greeting',
      schema: schema,
      input: {
        kind: 'greeting',
        foo: 'FOO',
        bar: 42,
        hi: 'HI',
        hello: 45
      },
      expected: JSON.stringify({
        kind: 'greeting',
        hi: 'HI',
        hello: 45
      })
    }
  ]

  tests.forEach(test => {
    t.test(test.name + ' - normal', t => {
      t.plan(1)

      const stringify = build(test.schema)
      const serialized = stringify(test.input)
      t.equal(serialized, test.expected)
    })

    t.test(test.name + ' - uglify', t => {
      t.plan(1)

      const stringify = build(test.schema, { uglify: true })
      const serialized = stringify(test.input)
      t.equal(serialized, test.expected)
    })
  })

  t.end()
})
