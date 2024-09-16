'use strict'

const { describe } = require('node:test')
const { deepStrictEqual, throws } = require('node:assert')
const build = require('..')

process.env.TZ = 'UTC'

describe('object with multiple types field', () => {
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

  deepStrictEqual(stringify({
    str: 'string'
  }), '{"str":"string"}')

  deepStrictEqual(stringify({
    str: true
  }), '{"str":true}')
})

describe('object with field of type object or null', () => {
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

  deepStrictEqual(stringify({
    prop: null
  }), '{"prop":null}')

  deepStrictEqual(stringify({
    prop: {
      str: 'string'
    }
  }), '{"prop":{"str":"string"}}')
})

describe('object with field of type object or array', () => {
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

  deepStrictEqual(stringify({
    prop: {
      str: 'string'
    }
  }), '{"prop":{"str":"string"}}')

  deepStrictEqual(stringify({
    prop: ['string']
  }), '{"prop":["string"]}')
})

describe('object with field of type string and coercion disable ', () => {
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
  throws(() => stringify({ str: 1 }))
})

describe('object with field of type string and coercion enable ', () => {
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
  deepStrictEqual(value, '{"str":"1"}')
})

describe('object with field with type union of multiple objects', () => {
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

  deepStrictEqual(stringify({ anyOfSchema: { baz: 5 } }), '{"anyOfSchema":{"baz":5}}')

  deepStrictEqual(stringify({ anyOfSchema: { bar: 'foo' } }), '{"anyOfSchema":{"bar":"foo"}}')
})

describe('null value in schema', () => {
  const schema = {
    title: 'schema with null child',
    type: 'string',
    nullable: true,
    enum: [null]
  }

  build(schema)
})

describe('symbol value in schema', () => {
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
  deepStrictEqual(stringify({ value: 'foo' }), '{"value":"foo"}')
  deepStrictEqual(stringify({ value: 'bar' }), '{"value":"bar"}')
  deepStrictEqual(stringify({ value: 'baz' }), '{"value":"baz"}')
  throws(() => stringify({ value: 'qux' }))
})

describe('anyOf and $ref together', () => {
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

  deepStrictEqual(stringify({ cs: 'franco' }), '{"cs":"franco"}')

  deepStrictEqual(stringify({ cs: true }), '{"cs":true}')
})

describe('anyOf and $ref: 2 levels are fine', () => {
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
  deepStrictEqual(value, '{"cs":3}')
})

describe('anyOf and $ref: multiple levels should throw at build.', () => {
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

  deepStrictEqual(stringify({ cs: 3 }), '{"cs":3}')
  deepStrictEqual(stringify({ cs: true }), '{"cs":true}')
  deepStrictEqual(stringify({ cs: 'pippo' }), '{"cs":"pippo"}')
})

describe('anyOf and $ref - multiple external $ref', () => {
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

  deepStrictEqual(output, '{"obj":{"prop":{"prop2":"test"}}}')
})

describe('anyOf looks for all of the array items', () => {
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
  deepStrictEqual(value, '[{"savedId":"great"},{"error":"oops"}]')
})

describe('anyOf with enum with more than 100 entries', () => {
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
  deepStrictEqual(value, '["EUR","USD",null]')
})

describe('anyOf object with field date-time of type string with format or null', (t) => {
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

  deepStrictEqual(withOneOfStringify({
    prop: toStringify
  }), `{"prop":"${toStringify.toISOString()}"}`)
})

describe('anyOf object with nested field date-time of type string with format or null', (t) => {
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

  deepStrictEqual(withOneOfStringify(data), JSON.stringify(data))
})

describe('anyOf object with nested field date of type string with format or null', (t) => {
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
    prop: { nestedProp: new Date(1674263005800) }
  }

  deepStrictEqual(withOneOfStringify(data), '{"prop":{"nestedProp":"2023-01-21"}}')
})

describe('anyOf object with nested field time of type string with format or null', (t) => {
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
    prop: { nestedProp: new Date(1674263005800) }
  }
  deepStrictEqual(withOneOfStringify(data), '{"prop":{"nestedProp":"01:03:25"}}')
})

describe('anyOf object with field date of type string with format or null', (t) => {
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
  deepStrictEqual(withOneOfStringify({
    prop: toStringify
  }), '{"prop":"2011-01-01"}')
})

describe('anyOf object with invalid field date of type string with format or null', (t) => {
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
  throws(() => withOneOfStringify({ prop: toStringify }))
})

describe('anyOf with a nested external schema', () => {
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
  deepStrictEqual(stringify('foo'), '"foo"')
})

describe('object with ref and validated properties', () => {
  const externalSchemas = {
    RefSchema: {
      $id: 'RefSchema',
      type: 'string'
    }
  }

  const schema = {
    $id: 'root',
    type: 'object',
    properties: {
      id: {
        anyOf: [
          { type: 'string' },
          { type: 'number' }
        ]
      },
      reference: { $ref: 'RefSchema' }
    }
  }

  const stringify = build(schema, { schema: externalSchemas })
  deepStrictEqual(stringify({ id: 1, reference: 'hi' }), '{"id":1,"reference":"hi"}')
})

describe('anyOf required props', () => {
  const schema = {
    type: 'object',
    properties: {
      prop1: { type: 'string' },
      prop2: { type: 'string' },
      prop3: { type: 'string' }
    },
    required: ['prop1'],
    anyOf: [{ required: ['prop2'] }, { required: ['prop3'] }]
  }
  const stringify = build(schema)
  deepStrictEqual(stringify({ prop1: 'test', prop2: 'test2' }), '{"prop1":"test","prop2":"test2"}')
  deepStrictEqual(stringify({ prop1: 'test', prop3: 'test3' }), '{"prop1":"test","prop3":"test3"}')
  deepStrictEqual(stringify({ prop1: 'test', prop2: 'test2', prop3: 'test3' }), '{"prop1":"test","prop2":"test2","prop3":"test3"}')
})

describe('anyOf required props', () => {
  const schema = {
    type: 'object',
    properties: {
      prop1: { type: 'string' }
    },
    anyOf: [
      {
        properties: {
          prop2: { type: 'string' }
        }
      },
      {
        properties: {
          prop3: { type: 'string' }
        }
      }
    ]
  }
  const stringify = build(schema)
  deepStrictEqual(stringify({ prop1: 'test1' }), '{"prop1":"test1"}')
  deepStrictEqual(stringify({ prop2: 'test2' }), '{"prop2":"test2"}')
  deepStrictEqual(stringify({ prop1: 'test1', prop2: 'test2' }), '{"prop1":"test1","prop2":"test2"}')
})

describe('recursive nested anyOfs', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: {
        additionalProperties: false,
        anyOf: [{ $ref: '#' }]
      }
    }
  }

  const data = { foo: {} }
  const stringify = build(schema)
  deepStrictEqual(stringify(data), JSON.stringify(data))
})

describe('recursive nested anyOfs', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: {
        additionalProperties: false,
        anyOf: [{ anyOf: [{ $ref: '#' }] }]
      }
    }
  }

  const data = { foo: {} }
  const stringify = build(schema)
  deepStrictEqual(stringify(data), JSON.stringify(data))
})

describe('external recursive anyOfs', () => {
  const externalSchema = {
    type: 'object',
    properties: {
      foo: {
        properties: {
          bar: { type: 'string' }
        },
        anyOf: [{ $ref: '#' }]
      }
    }
  }

  const schema = {
    type: 'object',
    properties: {
      a: { $ref: 'externalSchema#/properties/foo' },
      b: { $ref: 'externalSchema#/properties/foo' }
    }
  }

  const data = {
    a: {
      foo: {},
      bar: '42',
      baz: 42
    },
    b: {
      foo: {},
      bar: '42',
      baz: 42
    }
  }
  const stringify = build(schema, { schema: { externalSchema } })
  deepStrictEqual(stringify(data), '{"a":{"bar":"42","foo":{}},"b":{"bar":"42","foo":{}}}')
})

describe('should build merged schemas twice', () => {
  const schema = {
    type: 'object',
    properties: {
      enums: {
        type: 'string',
        anyOf: [
          { type: 'string', const: 'FOO' },
          { type: 'string', const: 'BAR' }
        ]
      }
    }
  }

  {
    const stringify = build(schema)
    deepStrictEqual(stringify({ enums: 'FOO' }), '{"enums":"FOO"}')
  }

  {
    const stringify = build(schema)
    deepStrictEqual(stringify({ enums: 'BAR' }), '{"enums":"BAR"}')
  }
})
