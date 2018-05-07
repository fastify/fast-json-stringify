'use strict'

const t = require('tap')
const build = require('..')

const schema = {
  'type': 'object',
  'properties': {
  },
  'if': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar'] }
    }
  },
  'then': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar'] },
      'foo': { 'type': 'string' },
      'bar': { 'type': 'number' }
    }
  },
  'else': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['greeting'] },
      'hi': { 'type': 'string' },
      'hello': { 'type': 'number' }
    }
  }
}

const nestedSchema = {
  'type': 'object',
  'properties': { },
  'if': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar'] }
    }
  },
  'then': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar'] },
      'foo': { 'type': 'string' },
      'bar': { 'type': 'number' }
    }
  },
  'else': {
    'if': {
      'properties': {
        'kind': { 'type': 'string', 'enum': ['greeting'] }
      }
    },
    'then': {
      'properties': {
        'kind': { 'type': 'string', 'enum': ['greeting'] },
        'hi': { 'type': 'string' },
        'hello': { 'type': 'number' }
      }
    },
    'else': {
      'properties': {
        'kind': { 'type': 'string', 'enum': ['alphabet'] },
        'a': { 'type': 'string' },
        'b': { 'type': 'number' }
      }
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
    },
    {
      name: 'nested',
      schema: nestedSchema,
      input: {
        kind: 'alphabet',
        foo: 'FOO',
        bar: 42,
        hi: 'HI',
        hello: 45,
        a: 'A',
        b: 35
      },
      expected: JSON.stringify({
        kind: 'alphabet',
        a: 'A',
        b: 35
      })
    }
  ]

  tests.forEach(test => {
    t.test(test.name + ' - normal', t => {
      t.plan(1)

      const stringify = build(JSON.parse(JSON.stringify(test.schema)))
      const serialized = stringify(test.input)
      t.equal(serialized, test.expected)
    })

    t.test(test.name + ' - uglify', t => {
      t.plan(1)

      const stringify = build(JSON.parse(JSON.stringify(test.schema)), { uglify: true })
      const serialized = stringify(test.input)
      t.equal(serialized, test.expected)
    })
  })

  t.end()
})
