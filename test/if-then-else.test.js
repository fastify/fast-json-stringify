'use strict'

const t = require('tap')
const build = require('..')

process.env.TZ = 'UTC'

const schema = {
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
}

const nestedIfSchema = {
  type: 'object',
  properties: { },
  if: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['foobar', 'greeting'] }
    }
  },
  then: {
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
        hello: { type: 'number' }
      }
    }
  },
  else: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['alphabet'] },
      a: { type: 'string' },
      b: { type: 'number' }
    }
  }
}

const nestedElseSchema = {
  type: 'object',
  properties: { },
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
    if: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['greeting'] }
      }
    },
    then: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['greeting'] },
        hi: { type: 'string' },
        hello: { type: 'number' }
      }
    },
    else: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['alphabet'] },
        a: { type: 'string' },
        b: { type: 'number' }
      }
    }
  }
}

const nestedDeepElseSchema = {
  type: 'object',
  additionalProperties: schema
}

const noElseSchema = {
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
const deepFoobarInput = {
  foobar: fooBarInput
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
const deepFoobarOutput = JSON.stringify({
  foobar: JSON.parse(foobarOutput)
})
const noElseGreetingOutput = JSON.stringify({})

t.test('if-then-else', t => {
  const tests = [
    {
      name: 'foobar',
      schema,
      input: fooBarInput,
      expected: foobarOutput
    },
    {
      name: 'greeting',
      schema,
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
    },
    {
      name: 'deep then - else',
      schema: nestedDeepElseSchema,
      input: deepFoobarInput,
      expected: deepFoobarOutput
    },
    {
      name: 'no else',
      schema: noElseSchema,
      input: greetingInput,
      expected: noElseGreetingOutput
    }
  ]

  tests.forEach(test => {
    t.test(test.name + ' - normal', t => {
      t.plan(1)

      const stringify = build(JSON.parse(JSON.stringify(test.schema)), { ajv: { strictTypes: false } })
      const serialized = stringify(test.input)
      t.equal(serialized, test.expected)
    })
  })

  t.end()
})

t.test('nested if/then', t => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: { a: { type: 'string' } },
    if: {
      type: 'object',
      properties: { foo: { type: 'string' } }
    },
    then: {
      properties: { bar: { type: 'string' } },
      if: {
        type: 'object',
        properties: { foo1: { type: 'string' } }
      },
      then: {
        properties: { bar1: { type: 'string' } }
      }
    }
  }

  const stringify = build(schema)

  t.equal(
    stringify({ a: 'A', foo: 'foo', bar: 'bar' }),
    JSON.stringify({ a: 'A', bar: 'bar' })
  )

  t.equal(
    stringify({ a: 'A', foo: 'foo', bar: 'bar', foo1: 'foo1', bar1: 'bar1' }),
    JSON.stringify({ a: 'A', bar: 'bar', bar1: 'bar1' })
  )
})

t.test('if/else with string format', (t) => {
  t.plan(2)

  const schema = {
    if: { type: 'string' },
    then: { type: 'string', format: 'date' },
    else: { const: 'Invalid' }
  }

  const stringify = build(schema)

  const date = new Date(1674263005800)

  t.equal(stringify(date), '"2023-01-21"')
  t.equal(stringify('Invalid'), '"Invalid"')
})

t.test('if/else with const integers', (t) => {
  t.plan(2)

  const schema = {
    type: 'number',
    if: { type: 'number', minimum: 42 },
    then: { const: 66 },
    else: { const: 33 }
  }

  const stringify = build(schema)

  t.equal(stringify(100.32), '66')
  t.equal(stringify(10.12), '33')
})

t.test('if/else with array', (t) => {
  t.plan(2)

  const schema = {
    type: 'array',
    if: { type: 'array', maxItems: 1 },
    then: { items: { type: 'string' } },
    else: { items: { type: 'number' } }
  }

  const stringify = build(schema)

  t.equal(stringify(['1']), JSON.stringify(['1']))
  t.equal(stringify(['1', '2']), JSON.stringify([1, 2]))
})

t.test('external recursive if/then/else', (t) => {
  t.plan(1)

  const externalSchema = {
    type: 'object',
    properties: {
      base: { type: 'string' },
      self: { $ref: 'externalSchema#' }
    },
    if: {
      type: 'object',
      properties: {
        foo: { type: 'string', const: '41' }
      }
    },
    then: {
      type: 'object',
      properties: {
        bar: { type: 'string', const: '42' }
      }
    },
    else: {
      type: 'object',
      properties: {
        baz: { type: 'string', const: '43' }
      }
    }
  }

  const schema = {
    type: 'object',
    properties: {
      a: { $ref: 'externalSchema#/properties/self' },
      b: { $ref: 'externalSchema#/properties/self' }
    }
  }

  const data = {
    a: {
      base: 'a',
      foo: '41',
      bar: '42',
      baz: '43',
      ignore: 'ignored'
    },
    b: {
      base: 'b',
      foo: 'not-41',
      bar: '42',
      baz: '43',
      ignore: 'ignored'
    }
  }
  const stringify = build(schema, { schema: { externalSchema } })
  t.equal(stringify(data), '{"a":{"base":"a","bar":"42"},"b":{"base":"b","baz":"43"}}')
})
