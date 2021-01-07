'use strict'

const moment = require('moment')
const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('..')

function buildTest (schema, toStringify) {
  test(`render a ${schema.title} as JSON`, (t) => {
    t.plan(3)

    const validate = validator(schema)
    const stringify = build(schema)
    const output = stringify(toStringify)

    t.deepEqual(JSON.parse(output), toStringify)
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

test('moment array', (t) => {
  t.plan(1)
  const schema = {
    type: 'object',
    properties: {
      times: {
        type: 'array',
        items: {
          type: 'string',
          format: 'date-time'
        }
      }
    }
  }
  const stringify = build(schema)
  const value = stringify({
    times: [moment('2018-04-21T07:52:31.017Z')]
  })
  t.is(value, '{"times":["2018-04-21T07:52:31.017Z"]}')
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
  t.is(value, '[{"name":"name-0","option":"Foo"},{"name":"name-1","option":"Bar"}]')
})
