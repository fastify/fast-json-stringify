'use strict'

const { test } = require('node:test')
const validator = require('./utils/validator')
const build = require('..')
const Ajv = require('ajv')

test('error on invalid largeArrayMechanism', (t) => {
  t.plan(1)

  t.assert.throws(() => build({
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

test('does not leak largeArrayMechanism across build() calls', (t) => {
  t.plan(2)

  const users = []
  for (let i = 0; i < 100; i++) users.push({ name: 'user' + i, password: 'secret' + i })

  const schema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    }
  }

  // An unrelated build() opts into json-stringify for its own schema.
  const optedIn = build({ type: 'array' }, { largeArrayMechanism: 'json-stringify', largeArraySize: 100 })
  t.assert.equal(optedIn(users).includes('password'), true)

  // A later build() without options must not inherit the mechanism.
  const stringify = build(schema)
  t.assert.equal(stringify(users).includes('password'), false)
})

function buildTest (schema, toStringify, options) {
  test(`render a ${schema.title} as JSON`, (t) => {
    t.plan(3)

    const validate = validator(schema)
    const stringify = build(schema, options)
    const output = stringify(toStringify)

    t.assert.deepStrictEqual(JSON.parse(output), JSON.parse(JSON.stringify(toStringify)))
    t.assert.equal(output, JSON.stringify(toStringify))
    t.assert.ok(validate(JSON.parse(output)), 'valid schema')
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
  title: 'dates tuple $ref',
  definitions: {
    dateTime: {
      type: 'string',
      format: 'date-time'
    }
  },
  type: 'object',
  properties: {
    dates: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: [
        {
          $ref: '#/definitions/dateTime'
        },
        {
          $ref: '#/definitions/dateTime'
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
  t.assert.throws(() => stringify({ args: ['invalid'] }))
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

  t.assert.equal(result, '{"foo":["foo","bar",1]}')
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

  t.assert.equal(result, '{"foo":["foo"]}')
})

test('array items is a list of schema and additionalItems is false /1', (t) => {
  t.plan(1)

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
  t.assert.throws(() => stringify({ foo: ['foo', 'bar'] }), new Error('Item at 1 does not match schema definition.'))
})

test('array items is a list of schema and additionalItems is false /2', (t) => {
  t.plan(3)

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

  t.assert.throws(() => stringify({ foo: [1, 'bar'] }), new Error('Item at 0 does not match schema definition.'))
  t.assert.throws(() => stringify({ foo: ['foo', 1] }), new Error('Item at 1 does not match schema definition.'))
  t.assert.throws(() => stringify({ foo: ['foo', 'bar', 'baz'] }), new Error('Item at 2 does not match schema definition.'))
})

test('array items is a schema and additionalItems is false', (t) => {
  t.plan(2)

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
  t.assert.equal(stringify({ foo: ['foo', 'bar'] }), '{"foo":["foo","bar"]}')
  t.assert.equal(validate({ foo: ['foo', 'bar'] }), true)
})

test('array items is a list of schema and additionalItems is a schema', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      foo: {
        type: 'array',
        items: [
          { type: 'string' }
        ],
        additionalItems: { type: 'number' }
      }
    }
  }

  const stringify = build(schema)
  const result = stringify({ foo: ['foo', 42] })

  t.assert.equal(result, '{"foo":["foo",42]}')
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
  t.assert.equal(value, '[{"name":"name-0","option":"Foo"},{"name":"name-1","option":"Bar"}]')
})

test('different arrays with same item schemas', (t) => {
  t.plan(1)

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

  t.assert.equal(stringify(data), '{"array1":["bar"],"array2":["foo","bar"]}')
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

test('error on invalid value for largeArraySize /1', (t) => {
  t.plan(1)

  t.assert.throws(() => build({
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

test('error on invalid value for largeArraySize /2', (t) => {
  t.plan(1)

  t.assert.throws(() => build({
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

test('error on invalid value for largeArraySize /3', (t) => {
  t.plan(1)

  t.assert.throws(() => build({
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

buildTest({
  title: 'string array whose items declare const',
  type: 'array',
  items: { type: 'string', const: 'a' }
}, ['a', 'a'])

buildTest({
  title: 'string array whose items declare allOf',
  type: 'array',
  items: { type: 'string', allOf: [{ type: 'string' }] }
}, ['a', 'b'])

buildTest({
  title: 'string array whose items declare anyOf',
  type: 'array',
  items: { type: 'string', anyOf: [{ type: 'string' }] }
}, ['a', 'b'])

buildTest({
  title: 'string array whose items declare oneOf',
  type: 'array',
  items: { type: 'string', oneOf: [{ type: 'string' }] }
}, ['a', 'b'])

buildTest({
  title: 'string array whose items declare if',
  type: 'array',
  items: { type: 'string', if: { type: 'string' }, then: { type: 'string' } }
}, ['a', 'b'])

test('string array coerces a non-string item', (t) => {
  const stringify = build({
    type: 'array',
    items: { type: 'string' }
  }, { largeArraySize: 2 })
  const date = new Date('2020-01-02T03:04:05.006Z')

  t.assert.equal(
    stringify([1, 'a', null, date, /re/]),
    '["1","a","","2020-01-02T03:04:05.006Z","re"]'
  )
})

// Large number/integer arrays are copied and handed to JSON.stringify. The
// first element that is not already the right type switches to the per-item
// loop from that index on. 3e5 elements is the largest fast-path cutoff on
// any supported Node release (see PRIMITIVE_FAST_PATH_MIN_LENGTH in index.js),
// so these always exercise the resume path.
const FAST_PATH_LENGTH = 3e5

for (const [type, bad, expected] of [
  ['integer', 1.9, '1'],
  ['integer', '7', '7'],
  ['integer', null, '0'],
  ['number', '7.5', '7.5'],
  ['number', null, '0'],
  ['number', true, '1']
]) {
  for (const [position, index] of [
    ['start', 0],
    ['middle', FAST_PATH_LENGTH >> 1],
    ['end', FAST_PATH_LENGTH - 1]
  ]) {
    test(`large ${type} array falls back to the loop on ${JSON.stringify(bad)} at the ${position}`, (t) => {
      const stringify = build({ type: 'array', items: { type } })
      const input = Array.from({ length: FAST_PATH_LENGTH }, (_, i) => i - 1000)
      input[index] = bad

      const reference = Array.from(input, (v, i) => i === index ? expected : String(v))
      t.assert.equal(stringify(input), '[' + reference.join(',') + ']')
    })
  }
}

test('large integer array applies the rounding option after the fallback', (t) => {
  const stringify = build({ type: 'array', items: { type: 'integer' } }, { rounding: 'ceil' })
  const input = Array.from({ length: FAST_PATH_LENGTH }, (_, i) => i)
  input[10] = 1.1
  input[FAST_PATH_LENGTH - 1] = 2.1

  const output = stringify(input)
  t.assert.equal(output.slice(0, 23), '[0,1,2,3,4,5,6,7,8,9,2,')
  t.assert.equal(output.slice(-3), ',3]')
})

test('large number array still throws on a non-numeric string after the fallback', (t) => {
  const stringify = build({ type: 'array', items: { type: 'number' } })
  const input = Array.from({ length: FAST_PATH_LENGTH }, (_, i) => i / 10)
  input[FAST_PATH_LENGTH >> 1] = 'not a number'

  t.assert.throws(() => stringify(input), new Error('The value "not a number" cannot be converted to a number.'))
})

// A real NaN is typeof 'number', so only the `v === v` half of the fast-path
// condition rejects it. Check it at every position the copy loop can stop at.
for (const [position, index] of [['start', 0], ['middle', FAST_PATH_LENGTH >> 1], ['end', FAST_PATH_LENGTH - 1]]) {
  test(`large number array still throws on NaN at the ${position} after the fallback`, (t) => {
    const stringify = build({ type: 'array', items: { type: 'number' } })
    const input = Array.from({ length: FAST_PATH_LENGTH }, (_, i) => i / 10)
    input[index] = NaN

    t.assert.throws(() => stringify(input), new Error('The value "NaN" cannot be converted to a number.'))
  })
}

test('large number array reads each element once across the fallback', (t) => {
  const stringify = build({ type: 'array', items: { type: 'number' } })
  const input = Array.from({ length: FAST_PATH_LENGTH }, (_, i) => i)
  const reads = []
  for (const index of [0, 1, FAST_PATH_LENGTH >> 1, FAST_PATH_LENGTH - 1]) {
    Object.defineProperty(input, index, {
      get () {
        reads.push(index)
        return index === 1 ? '1' : index
      }
    })
  }

  t.assert.equal(stringify(input), JSON.stringify(Array.from({ length: FAST_PATH_LENGTH }, (_, i) => i)))
  t.assert.deepEqual(reads, [0, 1, FAST_PATH_LENGTH >> 1, FAST_PATH_LENGTH - 1])
})
