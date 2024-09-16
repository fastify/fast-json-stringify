'use strict'

const { describe } = require('node:test')
const { equal, throws } = require('node:assert')
const build = require('..')

describe('object with multiple types field', (t) => {
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

  equal(stringify({ str: 'string' }), '{"str":"string"}')
  equal(stringify({ str: true }), '{"str":true}')
})

describe('object with field of type object or null', (t) => {
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

  equal(stringify({ prop: null }), '{"prop":null}')

  equal(stringify({
    prop: {
      str: 'string', remove: 'this'
    }
  }), '{"prop":{"str":"string"}}')
})

describe('object with field of type object or array', (t) => {
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

  equal(stringify({
    prop: { str: 'string' }
  }), '{"prop":{"str":"string"}}')

  equal(stringify({
    prop: ['string']
  }), '{"prop":["string"]}')
})

describe('object with field of type string and coercion disable ', (t) => {
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
  throws(() => stringify({ str: 1 }))
})

describe('object with field of type string and coercion enable ', (t) => {
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
  equal(value, '{"str":"1"}')
})

describe('object with field with type union of multiple objects', (t) => {
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

  equal(stringify({ oneOfSchema: { baz: 5 } }), '{"oneOfSchema":{"baz":5}}')

  equal(stringify({ oneOfSchema: { bar: 'foo' } }), '{"oneOfSchema":{"bar":"foo"}}')
})

describe('null value in schema', (t) => {
  const schema = {
    title: 'schema with null child',
    type: 'string',
    nullable: true,
    enum: [null]
  }

  build(schema)
})

describe('oneOf and $ref together', (t) => {
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

  equal(stringify({ cs: 'franco' }), '{"cs":"franco"}')

  equal(stringify({ cs: true }), '{"cs":true}')
})

describe('oneOf and $ref: 2 levels are fine', (t) => {
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
  equal(value, '{"cs":3}')
})

describe('oneOf and $ref: multiple levels should throw at build.', (t) => {
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

  equal(stringify({ cs: 3 }), '{"cs":3}')
  equal(stringify({ cs: true }), '{"cs":true}')
  equal(stringify({ cs: 'pippo' }), '{"cs":"pippo"}')
})

describe('oneOf and $ref - multiple external $ref', (t) => {
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

  JSON.parse(output)

  equal(output, '{"obj":{"prop":{"prop2":"test"}}}')
})

describe('oneOf with enum with more than 100 entries', (t) => {
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
  equal(value, '["EUR","USD",null]')
})

describe('oneOf object with field of type string with format or null', (t) => {
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

  equal(withOneOfStringify({
    prop: toStringify
  }), `{"prop":"${toStringify.toISOString()}"}`)
})

describe('one array item match oneOf types', (t) => {
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

  equal(stringify({ data: ['foo'] }), '{"data":["foo"]}')
  equal(stringify({ data: [1] }), '{"data":[1]}')
  throws(() => stringify({ data: [false, 'foo'] }))
})

describe('some array items match oneOf types', (t) => {
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

  equal(stringify({ data: ['foo', 5] }), '{"data":["foo",5]}')
  throws(() => stringify({ data: [false, 'foo', true, 5] }))
})

describe('all array items does not match oneOf types', (t) => {
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

  throws(() => stringify({ data: [null, false, true, undefined, [], {}] }))
})
