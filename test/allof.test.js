'use strict'

const { describe } = require('node:test')
const { deepStrictEqual, ok, fail } = require('node:assert')
const build = require('..')

process.env.TZ = 'UTC'

describe('allOf: combine type and format ', () => {
  const schema = {
    allOf: [
      { type: 'string' },
      { format: 'time' }
    ]
  }
  const stringify = build(schema)
  const date = new Date(1674263005800)
  const value = stringify(date)
  deepStrictEqual(value, '"01:03:25"')
})

describe('allOf: combine additional properties ', () => {
  const schema = {
    allOf: [
      { type: 'object' },
      {
        type: 'object',
        additionalProperties: { type: 'boolean' }
      }
    ]
  }
  const stringify = build(schema)
  const data = { property: true }
  const value = stringify(data)
  deepStrictEqual(value, JSON.stringify(data))
})

describe('allOf: combine pattern properties', () => {
  const schema = {
    allOf: [
      { type: 'object' },
      {
        type: 'object',
        patternProperties: {
          foo: {
            type: 'number'
          }
        }
      }
    ]
  }
  const stringify = build(schema)
  const data = { foo: 42 }
  const value = stringify(data)
  deepStrictEqual(value, JSON.stringify(data))
})

describe('object with allOf and multiple schema on the allOf', () => {
  const schema = {
    title: 'object with allOf and multiple schema on the allOf',
    type: 'object',
    allOf: [
      {
        type: 'object',
        required: [
          'name'
        ],
        properties: {
          name: {
            type: 'string'
          },
          tag: {
            type: 'string'
          }
        }
      },
      {
        required: [
          'id'
        ],
        type: 'object',
        properties: {
          id: {
            type: 'integer'
          }
        }
      }
    ]
  }
  const stringify = build(schema)

  try {
    stringify({
      id: 1
    })
  } catch (e) {
    deepStrictEqual(e.message, '"name" is required!')
  }

  try {
    stringify({
      name: 'string'
    })
  } catch (e) {
    deepStrictEqual(e.message, '"id" is required!')
  }

  deepStrictEqual(stringify({
    id: 1,
    name: 'string'
  }), '{"name":"string","id":1}')

  deepStrictEqual(stringify({
    id: 1,
    name: 'string',
    tag: 'otherString'
  }), '{"name":"string","id":1,"tag":"otherString"}')
})

describe('object with allOf and one schema on the allOf', () => {
  const schema = {
    title: 'object with allOf and one schema on the allOf',
    type: 'object',
    allOf: [
      {
        required: [
          'id'
        ],
        type: 'object',
        properties: {
          id: {
            type: 'integer'
          }
        }
      }
    ]
  }
  const stringify = build(schema)

  const value = stringify({
    id: 1
  })
  deepStrictEqual(value, '{"id":1}')
})

describe('object with allOf and no schema on the allOf', () => {
  const schema = {
    title: 'object with allOf and no schema on the allOf',
    type: 'object',
    allOf: []
  }

  try {
    build(schema)
    fail()
  } catch (e) {
    deepStrictEqual(e.message, 'schema is invalid: data/allOf must NOT have fewer than 1 items')
  }
})

describe('object with nested allOfs', () => {
  const schema = {
    title: 'object with nested allOfs',
    type: 'object',
    allOf: [
      {
        required: [
          'id1'
        ],
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          }
        }
      },
      {
        allOf: [
          {
            type: 'object',
            properties: {
              id2: {
                type: 'integer'
              }
            }
          },
          {
            type: 'object',
            properties: {
              id3: {
                type: 'integer'
              }
            }
          }
        ]
      }
    ]
  }

  const stringify = build(schema)
  const value = stringify({
    id1: 1,
    id2: 2,
    id3: 3,
    id4: 4 // extra prop shouldn't be in result
  })
  deepStrictEqual(value, '{"id1":1,"id2":2,"id3":3}')
})

describe('object with anyOf nested inside allOf', () => {
  const schema = {
    title: 'object with anyOf nested inside allOf',
    type: 'object',
    allOf: [
      {
        required: ['id1', 'obj'],
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          },
          obj: {
            type: 'object',
            properties: {
              nested: { type: 'string' }
            }
          }
        }
      },
      {
        anyOf: [
          {
            type: 'object',
            properties: {
              id2: { type: 'string' }
            },
            required: ['id2']
          },
          {
            type: 'object',
            properties: {
              id3: {
                type: 'integer'
              },
              nestedObj: {
                type: 'object',
                properties: {
                  nested: { type: 'string' }
                }
              }
            },
            required: ['id3']
          },
          {
            type: 'object',
            properties: {
              id4: { type: 'integer' }
            },
            required: ['id4']
          }
        ]
      }
    ]
  }

  const stringify = build(schema)
  const value = stringify({
    id1: 1,
    id3: 3,
    id4: 4, // extra prop shouldn't be in result
    obj: { nested: 'yes' },
    nestedObj: { nested: 'yes' }
  })
  deepStrictEqual(value, '{"id1":1,"obj":{"nested":"yes"},"id3":3,"nestedObj":{"nested":"yes"}}')
})

describe('object with $ref in allOf', () => {
  const schema = {
    title: 'object with $ref in allOf',
    type: 'object',
    definitions: {
      id1: {
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          }
        }
      }
    },
    allOf: [
      {
        $ref: '#/definitions/id1'
      }
    ]
  }

  const stringify = build(schema)
  const value = stringify({
    id1: 1,
    id2: 2 // extra prop shouldn't be in result
  })
  deepStrictEqual(value, '{"id1":1}')
})

describe('object with $ref and other object in allOf', () => {
  const schema = {
    title: 'object with $ref in allOf',
    type: 'object',
    definitions: {
      id1: {
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          }
        }
      }
    },
    allOf: [
      {
        $ref: '#/definitions/id1'
      },
      {
        type: 'object',
        properties: {
          id2: {
            type: 'integer'
          }
        }
      }
    ]
  }

  const stringify = build(schema)
  const value = stringify({
    id1: 1,
    id2: 2,
    id3: 3 // extra prop shouldn't be in result
  })
  deepStrictEqual(value, '{"id1":1,"id2":2}')
})

describe('object with multiple $refs in allOf', () => {
  const schema = {
    title: 'object with $ref in allOf',
    type: 'object',
    definitions: {
      id1: {
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          }
        }
      },
      id2: {
        type: 'object',
        properties: {
          id2: {
            type: 'integer'
          }
        }
      }
    },
    allOf: [
      {
        $ref: '#/definitions/id1'
      },
      {
        $ref: '#/definitions/id2'
      }
    ]
  }

  const stringify = build(schema)
  const value = stringify({
    id1: 1,
    id2: 2,
    id3: 3 // extra prop shouldn't be in result
  })
  deepStrictEqual(value, '{"id1":1,"id2":2}')
})

describe('allOf with nested allOf in $ref', () => {
  const schema = {
    title: 'allOf with nested allOf in $ref',
    type: 'object',
    definitions: {
      group: {
        type: 'object',
        allOf: [{
          properties: {
            id2: {
              type: 'integer'
            }
          }
        }, {
          properties: {
            id3: {
              type: 'integer'
            }
          }
        }]
      }
    },
    allOf: [
      {
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          }
        },
        required: [
          'id1'
        ]
      },
      {
        $ref: '#/definitions/group'
      }
    ]
  }

  const stringify = build(schema)
  const value = stringify({
    id1: 1,
    id2: 2,
    id3: 3,
    id4: 4 // extra prop shouldn't be in result
  })
  deepStrictEqual(value, '{"id1":1,"id2":2,"id3":3}')
})

describe('object with external $refs in allOf', () => {
  const externalSchema = {
    first: {
      definitions: {
        id1: {
          type: 'object',
          properties: {
            id1: {
              type: 'integer'
            }
          }
        }
      }
    },
    second: {
      definitions: {
        id2: {
          $id: '#id2',
          type: 'object',
          properties: {
            id2: {
              type: 'integer'
            }
          }
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref in allOf',
    type: 'object',
    allOf: [
      {
        $ref: 'first#/definitions/id1'
      },
      {
        $ref: 'second#/definitions/id2'
      }
    ]
  }

  const stringify = build(schema, { schema: externalSchema })
  const value = stringify({
    id1: 1,
    id2: 2,
    id3: 3 // extra prop shouldn't be in result
  })
  deepStrictEqual(value, '{"id1":1,"id2":2}')
})

describe('allof with local anchor reference', () => {
  const externalSchemas = {
    Test: {
      $id: 'Test',
      definitions: {
        Problem: {
          type: 'object',
          properties: {
            type: {
              type: 'string'
            }
          }
        },
        ValidationFragment: {
          type: 'string'
        },
        ValidationErrorProblem: {
          type: 'object',
          allOf: [
            {
              $ref: '#/definitions/Problem'
            },
            {
              type: 'object',
              properties: {
                validation: {
                  $ref: '#/definitions/ValidationFragment'
                }
              }
            }
          ]
        }
      }
    }
  }

  const schema = { $ref: 'Test#/definitions/ValidationErrorProblem' }
  const stringify = build(schema, { schema: externalSchemas })
  const data = { type: 'foo', validation: 'bar' }

  deepStrictEqual(stringify(data), JSON.stringify(data))
})

describe('allOf: multiple nested $ref properties', () => {
  const externalSchema1 = {
    $id: 'externalSchema1',
    oneOf: [
      { $ref: '#/definitions/id1' }
    ],
    definitions: {
      id1: {
        type: 'object',
        properties: {
          id1: {
            type: 'integer'
          }
        },
        additionalProperties: false
      }
    }
  }

  const externalSchema2 = {
    $id: 'externalSchema2',
    oneOf: [
      { $ref: '#/definitions/id2' }
    ],
    definitions: {
      id2: {
        type: 'object',
        properties: {
          id2: {
            type: 'integer'
          }
        },
        additionalProperties: false
      }
    }
  }

  const schema = {
    anyOf: [
      { $ref: 'externalSchema1' },
      { $ref: 'externalSchema2' }
    ]
  }

  const stringify = build(schema, { schema: [externalSchema1, externalSchema2] })

  deepStrictEqual(stringify({ id1: 1 }), JSON.stringify({ id1: 1 }))
  deepStrictEqual(stringify({ id2: 2 }), JSON.stringify({ id2: 2 }))
})

describe('allOf: throw Error if types mismatch ', () => {
  const schema = {
    allOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  }
  try {
    build(schema)
    fail('should throw the MergeError')
  } catch (error) {
    ok(error instanceof Error)
    deepStrictEqual(error.message, 'Failed to merge "type" keyword schemas.')
    deepStrictEqual(error.schemas, [['string'], ['number']])
  }
})

describe('allOf: throw Error if format mismatch ', () => {
  const schema = {
    allOf: [
      { format: 'date' },
      { format: 'time' }
    ]
  }
  try {
    build(schema)
    fail('should throw the MergeError')
  } catch (error) {
    ok(error instanceof Error)
    deepStrictEqual(error.message, 'Failed to merge "format" keyword schemas.')
    deepStrictEqual(error.schemas, ['date', 'time'])
  }
})

describe('recursive nested allOfs', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: {
        additionalProperties: false,
        allOf: [{ $ref: '#' }]
      }
    }
  }

  const data = { foo: {} }
  const stringify = build(schema)
  deepStrictEqual(stringify(data), JSON.stringify(data))
})

describe('recursive nested allOfs', () => {
  const schema = {
    type: 'object',
    properties: {
      foo: {
        additionalProperties: false,
        allOf: [{ allOf: [{ $ref: '#' }] }]
      }
    }
  }

  const data = { foo: {} }
  const stringify = build(schema)
  deepStrictEqual(stringify(data), JSON.stringify(data))
})

describe('external recursive allOfs', () => {
  const externalSchema = {
    type: 'object',
    properties: {
      foo: {
        properties: {
          bar: { type: 'string' }
        },
        allOf: [{ $ref: '#' }]
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

describe('do not crash with $ref prop', () => {
  const schema = {
    title: 'object with $ref',
    type: 'object',
    properties: {
      outside: {
        $ref: '#/$defs/outside'
      }
    },
    $defs: {
      inside: {
        type: 'object',
        properties: {
          $ref: {
            type: 'string'
          }
        }
      },
      outside: {
        allOf: [{
          $ref: '#/$defs/inside'
        }]
      }
    }
  }
  const stringify = build(schema)
  const value = stringify({
    outside: {
      $ref: 'true'
    }
  })
  deepStrictEqual(value, '{"outside":{"$ref":"true"}}')
})
