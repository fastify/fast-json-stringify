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
      'bar': { 'type': 'number' },
      'list': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'name': { 'type': 'string' },
            'value': { 'type': 'string' }
          }
        }
      }
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

const nestedIfSchema = {
  'type': 'object',
  'properties': { },
  'if': {
    'properties': {
      'kind': { 'type': 'string', 'enum': ['foobar', 'greeting'] }
    }
  },
  'then': {
    'if': {
      'properties': {
        'kind': { 'type': 'string', 'enum': ['foobar'] }
      }
    },
    'then': {
      'properties': {
        'kind': { 'type': 'string', 'enum': ['foobar'] },
        'foo': { 'type': 'string' },
        'bar': { 'type': 'number' },
        'list': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'name': { 'type': 'string' },
              'value': { 'type': 'string' }
            }
          }
        }
      }
    },
    'else': {
      'properties': {
        'kind': { 'type': 'string', 'enum': ['greeting'] },
        'hi': { 'type': 'string' },
        'hello': { 'type': 'number' }
      }
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

const nestedElseSchema = {
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
      'bar': { 'type': 'number' },
      'list': {
        'type': 'array',
        'items': {
          'type': 'object',
          'properties': {
            'name': { 'type': 'string' },
            'value': { 'type': 'string' }
          }
        }
      }
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

const fooBarInput = {
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
}
const greetingInput = {
  kind: 'greeting',
  foo: 'FOO',
  bar: 42,
  hi: 'HI',
  hello: 45,
  a: 'A',
  b: 35
}
const alphabetInput = {
  kind: 'alphabet',
  foo: 'FOO',
  bar: 42,
  hi: 'HI',
  hello: 45,
  a: 'A',
  b: 35
}
const foobarOutput = JSON.stringify({
  kind: 'foobar',
  foo: 'FOO',
  bar: 42,
  list: [{
    name: 'name',
    value: 'foo'
  }]
})
const greetingOutput = JSON.stringify({
  kind: 'greeting',
  hi: 'HI',
  hello: 45
})
const alphabetOutput = JSON.stringify({
  kind: 'alphabet',
  a: 'A',
  b: 35
})

t.test('if-then-else', t => {
  const tests = [
    {
      name: 'foobar',
      schema: schema,
      input: fooBarInput,
      expected: foobarOutput
    },
    {
      name: 'greeting',
      schema: schema,
      input: greetingInput,
      expected: greetingOutput
    },
    {
      name: 'if nested - then then',
      schema: nestedIfSchema,
      input: fooBarInput,
      expected: foobarOutput
    },
    {
      name: 'if nested - then else',
      schema: nestedIfSchema,
      input: greetingInput,
      expected: greetingOutput
    },
    {
      name: 'if nested - else',
      schema: nestedIfSchema,
      input: alphabetInput,
      expected: alphabetOutput
    },
    {
      name: 'else nested - then',
      schema: nestedElseSchema,
      input: fooBarInput,
      expected: foobarOutput
    },
    {
      name: 'else nested - else then',
      schema: nestedElseSchema,
      input: greetingInput,
      expected: greetingOutput
    },
    {
      name: 'else nested - else else',
      schema: nestedElseSchema,
      input: alphabetInput,
      expected: alphabetOutput
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
