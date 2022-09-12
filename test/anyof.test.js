'use strict'

const { DateTime } = require('luxon')
const { test } = require('tap')
const build = require('..')

test('object with multiple types field', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with multiple types field',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string'
        }, {
          type: 'boolean'
        }]
      }
    }
  }
  const stringify = build(schema)

  t.equal(stringify({
    str: 'string'
  }), '{"str":"string"}')

  t.equal(stringify({
    str: true
  }), '{"str":true}')
})

test('object with field of type object or null', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with field of type object or null',
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'object',
          properties: {
            str: {
              type: 'string'
            }
          }
        }, {
          type: 'null'
        }]
      }
    }
  }
  const stringify = build(schema)

  t.equal(stringify({
    prop: null
  }), '{"prop":null}')

  t.equal(stringify({
    prop: {
      str: 'string'
    }
  }), '{"prop":{"str":"string"}}')
})

test('object with field of type object or array', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with field of type object or array',
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'object',
          properties: {},
          additionalProperties: true
        }, {
          type: 'array',
          items: {
            type: 'string'
          }
        }]
      }
    }
  }
  const stringify = build(schema)

  t.equal(stringify({
    prop: {
      str: 'string'
    }
  }), '{"prop":{"str":"string"}}')

  t.equal(stringify({
    prop: ['string']
  }), '{"prop":["string"]}')
})

test('object with field of type string and coercion disable ', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with field of type string',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string'
        }]
      }
    }
  }
  const stringify = build(schema)
  t.throws(() => stringify({ str: 1 }))
})

test('object with field of type string and coercion enable ', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with field of type string',
    type: 'object',
    properties: {
      str: {
        anyOf: [{
          type: 'string'
        }]
      }
    }
  }

  const options = {
    ajv: {
      coerceTypes: true
    }
  }
  const stringify = build(schema, options)

  const value = stringify({
    str: 1
  })
  t.equal(value, '{"str":"1"}')
})

test('object with field with type union of multiple objects', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with anyOf property value containing objects',
    type: 'object',
    properties: {
      anyOfSchema: {
        anyOf: [
          {
            type: 'object',
            properties: {
              baz: { type: 'number' }
            },
            required: ['baz']
          },
          {
            type: 'object',
            properties: {
              bar: { type: 'string' }
            },
            required: ['bar']
          }
        ]
      }
    },
    required: ['anyOfSchema']
  }

  const stringify = build(schema)

  t.equal(stringify({ anyOfSchema: { baz: 5 } }), '{"anyOfSchema":{"baz":5}}')

  t.equal(stringify({ anyOfSchema: { bar: 'foo' } }), '{"anyOfSchema":{"bar":"foo"}}')
})

test('null value in schema', (t) => {
  t.plan(0)

  const schema = {
    title: 'schema with null child',
    type: 'string',
    nullable: true,
    enum: [null]
  }

  build(schema)
})

test('symbol value in schema', (t) => {
  t.plan(4)

  const ObjectKind = Symbol('LiteralKind')
  const UnionKind = Symbol('UnionKind')
  const LiteralKind = Symbol('LiteralKind')

  const schema = {
    kind: ObjectKind,
    type: 'object',
    properties: {
      value: {
        kind: UnionKind,
        anyOf: [
          { kind: LiteralKind, type: 'string', enum: ['foo'] },
          { kind: LiteralKind, type: 'string', enum: ['bar'] },
          { kind: LiteralKind, type: 'string', enum: ['baz'] }
        ]
      }
    },
    required: ['value']
  }

  const stringify = build(schema)
  t.equal(stringify({ value: 'foo' }), '{"value":"foo"}')
  t.equal(stringify({ value: 'bar' }), '{"value":"bar"}')
  t.equal(stringify({ value: 'baz' }), '{"value":"baz"}')
  t.throws(() => stringify({ value: 'qux' }))
})

test('anyOf and $ref together', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        anyOf: [
          {
            $ref: '#/definitions/Option'
          },
          {
            type: 'boolean'
          }
        ]
      }
    },
    definitions: {
      Option: {
        type: 'string'
      }
    }
  }

  const stringify = build(schema)

  t.equal(stringify({ cs: 'franco' }), '{"cs":"franco"}')

  t.equal(stringify({ cs: true }), '{"cs":true}')
})

test('anyOf and $ref: 2 levels are fine', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        anyOf: [
          {
            $ref: '#/definitions/Option'
          },
          {
            type: 'boolean'
          }
        ]
      }
    },
    definitions: {
      Option: {
        anyOf: [
          {
            type: 'number'
          },
          {
            type: 'boolean'
          }
        ]
      }
    }
  }

  const stringify = build(schema)
  const value = stringify({ cs: 3 })
  t.equal(value, '{"cs":3}')
})

test('anyOf and $ref: multiple levels should throw at build.', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        anyOf: [
          {
            $ref: '#/definitions/Option'
          },
          {
            type: 'boolean'
          }
        ]
      }
    },
    definitions: {
      Option: {
        anyOf: [
          {
            $ref: '#/definitions/Option2'
          },
          {
            type: 'string'
          }
        ]
      },
      Option2: {
        type: 'number'
      }
    }
  }

  const stringify = build(schema)

  t.equal(stringify({ cs: 3 }), '{"cs":3}')
  t.equal(stringify({ cs: true }), '{"cs":true}')
  t.equal(stringify({ cs: 'pippo' }), '{"cs":"pippo"}')
})

test('anyOf and $ref - multiple external $ref', (t) => {
  t.plan(2)

  const externalSchema = {
    external: {
      definitions: {
        def: {
          type: 'object',
          properties: {
            prop: { anyOf: [{ $ref: 'external2#/definitions/other' }] }
          }
        }
      }
    },
    external2: {
      definitions: {
        internal: {
          type: 'string'
        },
        other: {
          type: 'object',
          properties: {
            prop2: { $ref: '#/definitions/internal' }
          }
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref',
    type: 'object',
    properties: {
      obj: {
        $ref: 'external#/definitions/def'
      }
    }
  }

  const object = {
    obj: {
      prop: {
        prop2: 'test'
      }
    }
  }

  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"obj":{"prop":{"prop2":"test"}}}')
})

test('anyOf looks for all of the array items', (t) => {
  t.plan(1)

  const schema = {
    title: 'type array that may have any of declared items',
    type: 'array',
    items: {
      anyOf: [
        {
          type: 'object',
          properties: {
            savedId: {
              type: 'string'
            }
          },
          required: ['savedId']
        },
        {
          type: 'object',
          properties: {
            error: {
              type: 'string'
            }
          },
          required: ['error']
        }
      ]
    }
  }
  const stringify = build(schema)

  const value = stringify([{ savedId: 'great' }, { error: 'oops' }])
  t.equal(value, '[{"savedId":"great"},{"error":"oops"}]')
})

test('anyOf with enum with more than 100 entries', (t) => {
  t.plan(1)

  const schema = {
    title: 'type array that may have any of declared items',
    type: 'array',
    items: {
      anyOf: [
        {
          type: 'string',
          enum: ['EUR', 'USD', ...(new Set([...new Array(200)].map(() => Math.random().toString(36).substr(2, 3)))).values()]
        },
        { type: 'null' }
      ]
    }
  }
  const stringify = build(schema)

  const value = stringify(['EUR', 'USD', null])
  t.equal(value, '["EUR","USD",null]')
})

test('anyOf object with field date-time of type string with format or null', (t) => {
  t.plan(1)
  const toStringify = new Date()
  const withOneOfSchema = {
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'string',
          format: 'date-time'
        }, {
          type: 'null'
        }]
      }
    }
  }

  const withOneOfStringify = build(withOneOfSchema)

  t.equal(withOneOfStringify({
    prop: toStringify
  }), `{"prop":"${toStringify.toISOString()}"}`)
})

test('anyOf object with nested field date-time of type string with format or null', (t) => {
  t.plan(1)
  const withOneOfSchema = {
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'object',
          properties: {
            nestedProp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }]
      }
    }
  }

  const withOneOfStringify = build(withOneOfSchema)

  const data = {
    prop: { nestedProp: new Date() }
  }

  t.equal(withOneOfStringify(data), JSON.stringify(data))
})

test('anyOf object with nested field date of type string with format or null', (t) => {
  t.plan(1)
  const withOneOfSchema = {
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'object',
          properties: {
            nestedProp: {
              type: 'string',
              format: 'date'
            }
          }
        }]
      }
    }
  }

  const withOneOfStringify = build(withOneOfSchema)

  const data = {
    prop: { nestedProp: new Date() }
  }

  t.equal(withOneOfStringify(data), `{"prop":{"nestedProp":"${DateTime.fromJSDate(data.prop.nestedProp).toISODate()}"}}`)
})

test('anyOf object with nested field time of type string with format or null', (t) => {
  t.plan(1)
  const withOneOfSchema = {
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'object',
          properties: {
            nestedProp: {
              type: 'string',
              format: 'time'
            }
          }
        }]
      }
    }
  }

  const withOneOfStringify = build(withOneOfSchema)

  const data = {
    prop: { nestedProp: new Date() }
  }

  t.equal(withOneOfStringify(data), `{"prop":{"nestedProp":"${DateTime.fromJSDate(data.prop.nestedProp).toFormat('HH:mm:ss')}"}}`)
})

test('anyOf object with field date of type string with format or null', (t) => {
  t.plan(1)
  const toStringify = '2011-01-01'
  const withOneOfSchema = {
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'string',
          format: 'date'
        }, {
          type: 'null'
        }]
      }
    }
  }

  const withOneOfStringify = build(withOneOfSchema)
  t.equal(withOneOfStringify({
    prop: toStringify
  }), '{"prop":"2011-01-01"}')
})

test('anyOf object with invalid field date of type string with format or null', (t) => {
  t.plan(1)
  const toStringify = 'foo bar'
  const withOneOfSchema = {
    type: 'object',
    properties: {
      prop: {
        anyOf: [{
          type: 'string',
          format: 'date'
        }, {
          type: 'null'
        }]
      }
    }
  }

  const withOneOfStringify = build(withOneOfSchema)
  t.throws(() => withOneOfStringify({ prop: toStringify }))
})

test('anyOf with a nested external schema', (t) => {
  t.plan(1)

  const externalSchemas = {
    schema1: {
      definitions: {
        def1: {
          $id: 'external',
          type: 'string'
        }
      },
      type: 'number'
    }
  }
  const schema = { anyOf: [{ $ref: 'external' }] }

  const stringify = build(schema, { schema: externalSchemas })
  t.equal(stringify('foo'), '"foo"')
})
