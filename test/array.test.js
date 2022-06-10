'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('..')

function buildTest (schema, toStringify, options) {
  test(`render a ${schema.title} as JSON`, (t) => {
    t.plan(3)

    const validate = validator(schema)
    const stringify = build(schema, options)
    const output = stringify(toStringify)

    t.same(JSON.parse(output), toStringify)
    t.equal(output, JSON.stringify(toStringify))
    t.ok(validate(JSON.parse(output)), 'valid schema')
  })
}

buildTest({
  title: 'string array',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  }
}, {
  ids: ['test']
})

buildTest({
  title: 'number array',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: {
        type: 'number'
      }
    }
  }
}, {
  ids: [1]
})

buildTest({
  title: 'mixed array',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: [
        {
          type: 'null'
        },
        {
          type: 'string'
        },
        {
          type: 'integer'
        },
        {
          type: 'number'
        },
        {
          type: 'boolean'
        },
        {
          type: 'object',
          properties: {
            a: {
              type: 'string'
            }
          }
        },
        {
          type: 'array',
          items: {
            type: 'string'
          }
        }
      ]
    }
  }
}, {
  ids: [null, 'test', 1, 1.1, true, { a: 'test' }, ['test']]
})

buildTest({
  title: 'repeated types',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: [
        {
          type: 'number'
        },
        {
          type: 'number'
        }
      ]
    }
  }
}, { ids: [1, 2] })

buildTest({
  title: 'pattern properties array',
  type: 'object',
  properties: {
    args: {
      type: 'array',
      items: [
        {
          type: 'object',
          patternProperties: {
            '.*': {
              type: 'string'
            }
          }
        },
        {
          type: 'object',
          patternProperties: {
            '.*': {
              type: 'number'
            }
          }
        }
      ]
    }
  }
}, { args: [{ a: 'test' }, { b: 1 }] })

buildTest({
  title: 'array with weird key',
  type: 'object',
  properties: {
    '@data': {
      type: 'array',
      items: {
        type: 'string'
      }
    }
  }
}, {
  '@data': ['test']
})

test('invalid items throw', (t) => {
  t.plan(1)
  const schema = {
    type: 'object',
    properties: {
      args: {
        type: 'array',
        items: [
          {
            type: 'object',
            patternProperties: {
              '.*': {
                type: 'string'
              }
            }
          }
        ]
      }
    }
  }
  const stringify = build(schema)
  t.throws(() => stringify({ args: ['invalid'] }))
})

buildTest({
  title: 'item types in array default to any',
  type: 'object',
  properties: {
    foo: {
      type: 'array'
    }
  }
}, {
  foo: [1, 'string', {}, null]
})

test('array items is a list of schema and additionalItems is true, just the described item is validated', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'array',
        items: [
          {
            type: 'string'
          }
        ],
        additionalItems: true
      }
    }
  }

  const stringify = build(schema)
  const result = stringify({
    foo: [
      'foo',
      'bar',
      1
    ]
  })

  t.equal(result, '{"foo":["foo","bar",1]}')
})

test('array items is a list of schema and additionalItems is true, just the described item is validated', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'array',
        items: [
          {
            type: 'string'
          },
          {
            type: 'number'
          }
        ],
        additionalItems: true
      }
    }
  }

  const stringify = build(schema)
  const result = stringify({
    foo: ['foo']
  })

  t.equal(result, '{"foo":["foo"]}')
})

test('array items is a list of schema and additionalItems is false', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'array',
        items: [
          {
            type: 'string'
          }
        ],
        additionalItems: false
      }
    }
  }

  const stringify = build(schema)

  try {
    stringify({
      foo: [
        'foo',
        'bar'
      ]
    })
    t.fail()
  } catch (error) {
    t.ok(/does not match schema definition./.test(error.message))
  }
})

// https://github.com/fastify/fast-json-stringify/issues/279
test('object array with anyOf and symbol', (t) => {
  t.plan(1)
  const ArrayKind = Symbol('ArrayKind')
  const ObjectKind = Symbol('LiteralKind')
  const UnionKind = Symbol('UnionKind')
  const LiteralKind = Symbol('LiteralKind')
  const StringKind = Symbol('StringKind')

  const schema = {
    kind: ArrayKind,
    type: 'array',
    items: {
      kind: ObjectKind,
      type: 'object',
      properties: {
        name: {
          kind: StringKind,
          type: 'string'
        },
        option: {
          kind: UnionKind,
          anyOf: [
            {
              kind: LiteralKind,
              type: 'string',
              enum: ['Foo']
            },
            {
              kind: LiteralKind,
              type: 'string',
              enum: ['Bar']
            }
          ]
        }
      },
      required: ['name', 'option']
    }
  }
  const stringify = build(schema)
  const value = stringify([
    { name: 'name-0', option: 'Foo' },
    { name: 'name-1', option: 'Bar' }
  ])
  t.equal(value, '[{"name":"name-0","option":"Foo"},{"name":"name-1","option":"Bar"}]')
})

const largeArray = new Array(2e4).fill({ a: 'test', b: 1 })
buildTest({
  title: 'large array with default mechanism',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'number' }
        }
      }
    }
  }
}, {
  ids: largeArray
}, {
  largeArraySize: 2e4,
  largeArrayMechanism: 'default'
})

buildTest({
  title: 'large array of objects with json-stringify mechanism',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'number' }
        }
      }
    }
  }
}, {
  ids: largeArray
}, {
  largeArrayMechanism: 'json-stringify'
})

buildTest({
  title: 'large array of strings with default mechanism',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'string' }
    }
  }
}, {
  ids: new Array(2e4).fill('string')
}, {
  largeArraySize: 2e4,
  largeArrayMechanism: 'default'
})

buildTest({
  title: 'large array of numbers with default mechanism',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'number' }
    }
  }
}, {
  ids: new Array(2e4).fill(42)
}, {
  largeArraySize: 2e4,
  largeArrayMechanism: 'default'
})

buildTest({
  title: 'large array of integers with default mechanism',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'integer' }
    }
  }
}, {
  ids: new Array(2e4).fill(42)
}, {
  largeArraySize: 2e4,
  largeArrayMechanism: 'default'
})

buildTest({
  title: 'large array of booleans with default mechanism',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'boolean' }
    }
  }
}, {
  ids: new Array(2e4).fill(true)
}, {
  largeArraySize: 2e4,
  largeArrayMechanism: 'default'
})

buildTest({
  title: 'large array of null values with default mechanism',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'null' }
    }
  }
}, {
  ids: new Array(2e4).fill(null)
}, {
  largeArraySize: 2e4,
  largeArrayMechanism: 'default'
})
