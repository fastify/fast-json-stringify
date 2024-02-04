'use strict'

const test = require('tap').test
const build = require('..')

process.env.TZ = 'UTC'

test('allOf: combine type and format ', (t) => {
  t.plan(1)

  const schema = {
    allOf: [
      { type: 'string' },
      { format: 'time' }
    ]
  }
  const stringify = build(schema)
  const date = new Date(1674263005800)
  const value = stringify(date)
  t.equal(value, '"01:03:25"')
})

test('allOf: combine additional properties ', (t) => {
  t.plan(1)

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
  t.equal(value, JSON.stringify(data))
})

test('allOf: combine pattern properties', (t) => {
  t.plan(1)

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
  t.equal(value, JSON.stringify(data))
})

test('object with allOf and multiple schema on the allOf', (t) => {
  t.plan(4)

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
    t.equal(e.message, '"name" is required!')
  }

  try {
    stringify({
      name: 'string'
    })
  } catch (e) {
    t.equal(e.message, '"id" is required!')
  }

  t.equal(stringify({
    id: 1,
    name: 'string'
  }), '{"name":"string","id":1}')

  t.equal(stringify({
    id: 1,
    name: 'string',
    tag: 'otherString'
  }), '{"name":"string","id":1,"tag":"otherString"}')
})

test('object with allOf and one schema on the allOf', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id":1}')
})

test('object with allOf and no schema on the allOf', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with allOf and no schema on the allOf',
    type: 'object',
    allOf: []
  }

  try {
    build(schema)
    t.fail()
  } catch (e) {
    t.equal(e.message, 'schema is invalid: data/allOf must NOT have fewer than 1 items')
  }
})

test('object with nested allOfs', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id1":1,"id2":2,"id3":3}')
})

test('object with anyOf nested inside allOf', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id1":1,"obj":{"nested":"yes"},"id3":3,"nestedObj":{"nested":"yes"}}')
})

test('object with $ref in allOf', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id1":1}')
})

test('object with $ref and other object in allOf', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id1":1,"id2":2}')
})

test('object with multiple $refs in allOf', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id1":1,"id2":2}')
})

test('allOf with nested allOf in $ref', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id1":1,"id2":2,"id3":3}')
})

test('object with external $refs in allOf', (t) => {
  t.plan(1)

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
  t.equal(value, '{"id1":1,"id2":2}')
})

test('allof with local anchor reference', (t) => {
  t.plan(1)

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

  t.equal(stringify(data), JSON.stringify(data))
})

test('allOf: multiple nested $ref properties', (t) => {
  t.plan(2)

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

  t.equal(stringify({ id1: 1 }), JSON.stringify({ id1: 1 }))
  t.equal(stringify({ id2: 2 }), JSON.stringify({ id2: 2 }))
})

test('allOf: throw Error if types mismatch ', (t) => {
  t.plan(3)

  const schema = {
    allOf: [
      { type: 'string' },
      { type: 'number' }
    ]
  }
  try {
    build(schema)
    t.fail('should throw the MergeError')
  } catch (error) {
    t.ok(error instanceof Error)
    t.equal(error.message, 'Failed to merge "type" keyword schemas.')
    t.same(error.schemas, [['string'], ['number']])
  }
})

test('allOf: throw Error if format mismatch ', (t) => {
  t.plan(3)

  const schema = {
    allOf: [
      { format: 'date' },
      { format: 'time' }
    ]
  }
  try {
    build(schema)
    t.fail('should throw the MergeError')
  } catch (error) {
    t.ok(error instanceof Error)
    t.equal(error.message, 'Failed to merge "format" keyword schemas.')
    t.same(error.schemas, ['date', 'time'])
  }
})

test('recursive nested allOfs', (t) => {
  t.plan(1)

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
  t.equal(stringify(data), JSON.stringify(data))
})

test('recursive nested allOfs', (t) => {
  t.plan(1)

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
  t.equal(stringify(data), JSON.stringify(data))
})

test('external recursive allOfs', (t) => {
  t.plan(1)

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
  t.equal(stringify(data), '{"a":{"bar":"42","foo":{}},"b":{"bar":"42","foo":{}}}')
})
