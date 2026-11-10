'use strict'

const { test } = require('node:test')
const build = require('..')

test('object with multiple types field', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with multiple types field',
    type: 'object',
    properties: {
      str: {
        oneOf: [{
          type: 'string'
        }, {
          type: 'boolean'
        }]
      }
    }
  }
  const stringify = build(schema)

  t.assert.equal(stringify({ str: 'string' }), '{"str":"string"}')
  t.assert.equal(stringify({ str: true }), '{"str":true}')
})

test('object with field of type object or null', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with field of type object or null',
    type: 'object',
    properties: {
      prop: {
        oneOf: [{
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

  t.assert.equal(stringify({ prop: null }), '{"prop":null}')

  t.assert.equal(stringify({
    prop: {
      str: 'string', remove: 'this'
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
        oneOf: [{
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

  t.assert.equal(stringify({
    prop: { str: 'string' }
  }), '{"prop":{"str":"string"}}')

  t.assert.equal(stringify({
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
        oneOf: [{
          type: 'string'
        }]
      }
    }
  }
  const stringify = build(schema)
  t.assert.throws(() => stringify({ str: 1 }))
})

test('object with field of type string and coercion enable ', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with field of type string',
    type: 'object',
    properties: {
      str: {
        oneOf: [{
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
  t.assert.equal(value, '{"str":"1"}')
})

test('object with field with type union of multiple objects', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with oneOf property value containing objects',
    type: 'object',
    properties: {
      oneOfSchema: {
        oneOf: [
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
    required: ['oneOfSchema']
  }

  const stringify = build(schema)

  t.assert.equal(stringify({ oneOfSchema: { baz: 5 } }), '{"oneOfSchema":{"baz":5}}')

  t.assert.equal(stringify({ oneOfSchema: { bar: 'foo' } }), '{"oneOfSchema":{"bar":"foo"}}')
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

test('oneOf and $ref together', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        oneOf: [
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

  t.assert.equal(stringify({ cs: 'franco' }), '{"cs":"franco"}')

  t.assert.equal(stringify({ cs: true }), '{"cs":true}')
})

test('oneOf and $ref: 2 levels are fine', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        oneOf: [
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
        oneOf: [
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
  const value = stringify({
    cs: 3
  })
  t.assert.equal(value, '{"cs":3}')
})

test('oneOf and $ref: multiple levels should throw at build.', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    properties: {
      cs: {
        oneOf: [
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
        oneOf: [
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

  t.assert.equal(stringify({ cs: 3 }), '{"cs":3}')
  t.assert.equal(stringify({ cs: true }), '{"cs":true}')
  t.assert.equal(stringify({ cs: 'pippo' }), '{"cs":"pippo"}')
})

test('oneOf and $ref - multiple external $ref', (t) => {
  t.plan(2)

  const externalSchema = {
    external: {
      definitions: {
        def: {
          type: 'object',
          properties: {
            prop: { oneOf: [{ $ref: 'external2#/definitions/other' }] }
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

  t.assert.doesNotThrow(() => JSON.parse(output))
  t.assert.equal(output, '{"obj":{"prop":{"prop2":"test"}}}')
})

test('oneOf with a bare top-level $ref branch validates directly against the registered schema, not a root-relative pointer', (t) => {
  t.plan(3)

  const schema = {
    title: 'oneOf with bare $ref branches',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { $ref: 'Foo#' },
          { $ref: 'Bar#' }
        ]
      }
    }
  }
  const externalSchema = {
    Foo: {
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
      additionalProperties: false
    },
    Bar: {
      type: 'object',
      properties: { b: { type: 'string' } },
      required: ['b'],
      additionalProperties: false
    }
  }

  const code = build(schema, { mode: 'standalone', schema: externalSchema })
  t.assert.ok(code.includes('validator.validate("Foo#"'), 'validates directly against the bare registered id')
  t.assert.ok(code.includes('validator.validate("Bar#"'), 'validates directly against the bare registered id')

  const stringify = build(schema, { schema: externalSchema })
  t.assert.equal(stringify({ content: { b: 'yo' } }), '{"content":{"b":"yo"}}')
})

test('oneOf with a bare top-level $ref branch to a $id schema validates directly against the registered schema', (t) => {
  t.plan(2)

  const schema = {
    title: 'oneOf with bare $id $ref branch',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { $ref: 'urn:fjs:test:Foo#' },
          { type: 'null' }
        ]
      }
    }
  }
  const externalSchema = {
    Foo: {
      $id: 'urn:fjs:test:Foo',
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
      additionalProperties: false
    }
  }

  const code = build(schema, { mode: 'standalone', schema: externalSchema })
  t.assert.ok(code.includes('validator.validate("urn:fjs:test:Foo#"'), 'validates directly against the bare registered $id')

  const stringify = build(schema, { schema: externalSchema })
  t.assert.equal(stringify({ content: { a: 'yo' } }), '{"content":{"a":"yo"}}')
})

test('oneOf with a bare top-level $ref branch to a relative $id schema is left unchanged', (t) => {
  t.plan(1)

  const schema = {
    title: 'oneOf with bare $ref branch to relative $id',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { $ref: 'Foo#' },
          { type: 'null' }
        ]
      }
    }
  }
  const externalSchema = {
    Foo: {
      $id: '#foo',
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a']
    }
  }

  const code = build(schema, { mode: 'standalone', schema: externalSchema })
  t.assert.ok(!code.includes('validator.validate("Foo#"'), 'relative $id schema is not redirected to the bare parent id')
})

test('oneOf with a $ref branch to a relative root $id validates directly against the registered schema', (t) => {
  t.plan(2)

  const schema = {
    title: 'oneOf with $ref branch to relative root $id',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { $ref: 'Foo#foo' },
          { type: 'null' }
        ]
      }
    }
  }
  const externalSchema = {
    Foo: {
      $id: '#foo',
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a']
    }
  }

  const code = build(schema, { mode: 'standalone', schema: externalSchema })
  t.assert.ok(code.includes('validator.validate("Foo#foo"'), 'validates directly against the relative root $id')

  const stringify = build(schema, { schema: externalSchema })
  t.assert.equal(stringify({ content: { a: 'yo' } }), '{"content":{"a":"yo"}}')
})

test('oneOf with a named-fragment $ref branch validates directly against the registered schema anchor', (t) => {
  t.plan(2)

  const schema = {
    title: 'oneOf with named-fragment $ref branch',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { $ref: 'Foo#tag' },
          { type: 'null' }
        ]
      }
    }
  }
  const externalSchema = {
    Foo: {
      $id: 'Foo',
      $defs: {
        tag: { $id: '#tag', type: 'string' }
      }
    }
  }

  const code = build(schema, { mode: 'standalone', schema: externalSchema })
  t.assert.ok(code.includes('validator.validate("Foo#tag"'), 'validates directly against the registered schema anchor')

  const stringify = build(schema, { schema: externalSchema })
  t.assert.equal(stringify({ content: 'yo' }), '{"content":"yo"}')
})

test('oneOf with a $ref into a JSON-pointer sub-path validates directly against that sub-path', (t) => {
  t.plan(2)

  const schema = {
    title: 'oneOf with a sub-path $ref branch',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { $ref: 'Foo#/definitions/Bar' },
          { type: 'null' }
        ]
      }
    }
  }
  const externalSchema = {
    Foo: {
      definitions: {
        Bar: { type: 'object', properties: { b: { type: 'string' } } }
      }
    }
  }

  const code = build(schema, { mode: 'standalone', schema: externalSchema })
  t.assert.ok(code.includes('validator.validate("Foo#/definitions/Bar"'), 'validates directly against the sub-path ref')

  const stringify = build(schema, { schema: externalSchema })
  t.assert.equal(stringify({ content: { b: 'yo' } }), '{"content":{"b":"yo"}}')
})

test('oneOf with a $ref branch that has sibling keywords is left unchanged', (t) => {
  t.plan(2)

  const schema = {
    title: 'oneOf with a $ref branch with sibling keywords',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { $ref: 'Foo#', required: ['c'] },
          { type: 'null' }
        ]
      }
    }
  }
  const externalSchema = {
    Foo: {
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a']
    }
  }

  const code = build(schema, { mode: 'standalone', schema: externalSchema })
  t.assert.ok(!code.includes('validator.validate("Foo#"'), 'ref with sibling keywords is not redirected')

  const stringify = build(schema, { schema: externalSchema })
  t.assert.throws(() => stringify({ content: { a: 'yo' } }))
})

test('oneOf with an inline (non-$ref) branch is left unchanged', (t) => {
  t.plan(1)

  const schema = {
    title: 'oneOf with an inline branch, no $ref',
    type: 'object',
    properties: {
      content: {
        oneOf: [
          { type: 'string' },
          { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }
        ]
      }
    }
  }

  // Should compile and serialize exactly as before -- this is a pure
  // regression guard, not exercising the new code path at all.
  const stringify = build(schema)
  t.assert.equal(stringify({ content: 'hello' }), '{"content":"hello"}')
})

test('oneOf with enum with more than 100 entries', (t) => {
  t.plan(1)

  const schema = {
    title: 'type array that may have one of declared items',
    type: 'array',
    items: {
      oneOf: [
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
  t.assert.equal(value, '["EUR","USD",null]')
})

test('oneOf object with field of type string with format or null', (t) => {
  t.plan(1)

  const toStringify = new Date()

  const withOneOfSchema = {
    type: 'object',
    properties: {
      prop: {
        oneOf: [{
          type: 'string',
          format: 'date-time'
        }, {
          type: 'null'
        }]
      }
    }
  }

  const withOneOfStringify = build(withOneOfSchema)

  t.assert.equal(withOneOfStringify({
    prop: toStringify
  }), `{"prop":"${toStringify.toISOString()}"}`)
})

test('one array item match oneOf types', (t) => {
  t.plan(3)

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['data'],
    properties: {
      data: {
        type: 'array',
        minItems: 1,
        items: {
          oneOf: [
            {
              type: 'string'
            },
            {
              type: 'number'
            }
          ]
        }
      }
    }
  }

  const stringify = build(schema)

  t.assert.equal(stringify({ data: ['foo'] }), '{"data":["foo"]}')
  t.assert.equal(stringify({ data: [1] }), '{"data":[1]}')
  t.assert.throws(() => stringify({ data: [false, 'foo'] }))
})

test('some array items match oneOf types', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['data'],
    properties: {
      data: {
        type: 'array',
        minItems: 1,
        items: {
          oneOf: [
            {
              type: 'string'
            },
            {
              type: 'number'
            }
          ]
        }
      }
    }
  }

  const stringify = build(schema)

  t.assert.equal(stringify({ data: ['foo', 5] }), '{"data":["foo",5]}')
  t.assert.throws(() => stringify({ data: [false, 'foo', true, 5] }))
})

test('all array items does not match oneOf types', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['data'],
    properties: {
      data: {
        type: 'array',
        minItems: 1,
        items: {
          oneOf: [
            {
              type: 'string'
            },
            {
              type: 'number'
            }
          ]
        }
      }
    }
  }

  const stringify = build(schema)

  t.assert.throws(() => stringify({ data: [null, false, true, undefined, [], {}] }))
})

test('invalid oneOf schema', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      prop: {
        oneOf: 'not array'  // invalid, oneOf must be array
      }
    }
  }

  try {
    build(schema)
    t.assert.fail('Should throw')
  } catch (err) {
    t.assert.ok(err.message.includes('schema is invalid'))
  }
})

test('property named $id inside oneOf compiles and serializes correctly (#918)', (t) => {
  t.plan(2)

  const stringify = build({
    oneOf: [
      {
        type: 'object',
        properties: {
          $id: { type: 'string' }
        }
      },
      {
        type: 'number'
      }
    ]
  })

  t.assert.equal(stringify({ $id: 'x' }), '{"$id":"x"}')
  t.assert.equal(stringify(42), '42')
})
