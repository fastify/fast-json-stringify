'use strict'

const { describe } = require('node:test')
const { deepStrictEqual, throws, ok } = require('node:assert')
const validator = require('is-my-json-valid')
const build = require('..')
const Ajv = require('ajv')

describe('error on invalid largeArrayMechanism', () => {
  throws(() => build({
    title: 'large array of null values with default mechanism',
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'null' }
      }
    }
  }, {
    largeArraySize: 2e4,
    largeArrayMechanism: 'invalid'
  }), Error('Unsupported large array mechanism invalid'))
})

function buildTest (schema, toStringify, options) {
  describe(`render a ${schema.title} as JSON`, () => {
    const validate = validator(schema)
    const stringify = build(schema, options)
    const output = stringify(toStringify)

    deepStrictEqual(JSON.parse(output), JSON.parse(JSON.stringify(toStringify)))
    deepStrictEqual(output, JSON.stringify(toStringify))
    ok(validate(JSON.parse(output)), 'valid schema')
  })
}

buildTest({
  title: 'dates tuple',
  type: 'object',
  properties: {
    dates: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: [
        {
          type: 'string',
          format: 'date-time'
        },
        {
          type: 'string',
          format: 'date-time'
        }
      ]
    }
  }
}, {
  dates: [new Date(1), new Date(2)]
})

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

describe('invalid items throw', (t) => {
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
  throws(() => stringify({ args: ['invalid'] }))
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

describe('array items is a list of schema and additionalItems is true, just the described item is validated', () => {
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

  deepStrictEqual(result, '{"foo":["foo","bar",1]}')
})

describe('array items is a list of schema and additionalItems is true, just the described item is validated', () => {
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

  deepStrictEqual(result, '{"foo":["foo"]}')
})

describe('array items is a list of schema and additionalItems is false /1', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'array',
        items: [
          { type: 'string' }
        ],
        additionalItems: false
      }
    }
  }

  const stringify = build(schema)
  throws(() => stringify({ foo: ['foo', 'bar'] }), new Error('Item at 1 does not match schema definition.'))
})

describe('array items is a list of schema and additionalItems is false /2', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'array',
        items: [
          { type: 'string' },
          { type: 'string' }
        ],
        additionalItems: false
      }
    }
  }

  const stringify = build(schema)

  throws(() => stringify({ foo: [1, 'bar'] }), new Error('Item at 0 does not match schema definition.'))
  throws(() => stringify({ foo: ['foo', 1] }), new Error('Item at 1 does not match schema definition.'))
  throws(() => stringify({ foo: ['foo', 'bar', 'baz'] }), new Error('Item at 2 does not match schema definition.'))
})

describe('array items is a schema and additionalItems is false', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'array',
        items: { type: 'string' },
        additionalItems: false
      }
    }
  }

  const stringify = build(schema)

  // ajv ignores additionalItems if items is not an Array
  const ajv = new Ajv({ allErrors: true, strict: false })

  const validate = ajv.compile(schema)
  deepStrictEqual(stringify({ foo: ['foo', 'bar'] }), '{"foo":["foo","bar"]}')
  deepStrictEqual(validate({ foo: ['foo', 'bar'] }), true)
})

// https://github.com/fastify/fast-json-stringify/issues/279
describe('object array with anyOf and symbol', (t) => {
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
  deepStrictEqual(value, '[{"name":"name-0","option":"Foo"},{"name":"name-1","option":"Bar"}]')
})

describe('different arrays with same item schemas', () => {
  const schema = {
    type: 'object',
    properties: {
      array1: {
        type: 'array',
        items: [{ type: 'string' }],
        additionalItems: false
      },
      array2: {
        type: 'array',
        items: { $ref: '#/properties/array1/items' },
        additionalItems: true
      }
    }
  }

  const stringify = build(schema)
  const data = { array1: ['bar'], array2: ['foo', 'bar'] }

  deepStrictEqual(stringify(data), '{"array1":["bar"],"array2":["foo","bar"]}')
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

describe('error on invalid value for largeArraySize /1', () => {
  throws(() => build({
    title: 'large array of null values with default mechanism',
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'null' }
      }
    }
  }, {
    largeArraySize: 'invalid'
  }), Error('Unsupported large array size. Expected integer-like, got string with value invalid'))
})

describe('error on invalid value for largeArraySize /2', () => {
  throws(() => build({
    title: 'large array of null values with default mechanism',
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'null' }
      }
    }
  }, {
    largeArraySize: Infinity
  }), Error('Unsupported large array size. Expected integer-like, got number with value Infinity'))
})

describe('error on invalid value for largeArraySize /3', () => {
  throws(() => build({
    title: 'large array of null values with default mechanism',
    type: 'object',
    properties: {
      ids: {
        type: 'array',
        items: { type: 'null' }
      }
    }
  }, {
    largeArraySize: [200]
  }), Error('Unsupported large array size. Expected integer-like, got object with value 200'))
})

buildTest({
  title: 'large array of integers with largeArraySize is bigint',
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
  largeArraySize: 20000n,
  largeArrayMechanism: 'default'
})

buildTest({
  title: 'large array of integers with largeArraySize is valid string',
  type: 'object',
  properties: {
    ids: {
      type: 'array',
      items: { type: 'integer' }
    }
  }
}, {
  ids: new Array(1e4).fill(42)
}, {
  largeArraySize: '10000',
  largeArrayMechanism: 'default'
})
