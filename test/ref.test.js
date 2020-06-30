'use strict'

const test = require('tap').test
const build = require('..')

test('ref internal - properties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {
      obj: {
        $ref: '#/definitions/def'
      }
    }
  }

  const object = {
    obj: {
      str: 'test'
    }
  }

  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('ref internal - items', (t) => {
  t.plan(2)

  const schema = {
    title: 'array with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'array',
    items: { $ref: '#/definitions/def' }
  }

  const array = [{
    str: 'test'
  }]

  const stringify = build(schema)
  const output = stringify(array)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '[{"str":"test"}]')
})

test('ref external - properties', (t) => {
  t.plan(2)

  const externalSchema = {
    first: require('./ref.json'),
    second: {
      definitions: {
        num: {
          type: 'object',
          properties: {
            int: {
              type: 'integer'
            }
          }
        }
      }
    },
    third: {
      type: 'string'
    }
  }

  const schema = {
    title: 'object with $ref',
    type: 'object',
    properties: {
      obj: {
        $ref: 'first#/definitions/def'
      },
      num: {
        $ref: 'second#/definitions/num'
      },
      strPlain: {
        $ref: 'third'
      },
      strHash: {
        $ref: 'third#'
      }
    }
  }

  const object = {
    obj: {
      str: 'test'
    },
    num: {
      int: 42
    },
    strPlain: 'test',
    strHash: 'test'
  }

  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"obj":{"str":"test"},"num":{"int":42},"strPlain":"test","strHash":"test"}')
})

test('ref internal - patternProperties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {},
    patternProperties: {
      obj: {
        $ref: '#/definitions/def'
      }
    }
  }

  const object = {
    obj: {
      str: 'test'
    }
  }

  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('ref internal - additionalProperties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {},
    additionalProperties: {
      $ref: '#/definitions/def'
    }
  }

  const object = {
    obj: {
      str: 'test'
    }
  }

  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('ref internal - pattern-additional Properties', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {},
    patternProperties: {
      reg: {
        $ref: '#/definitions/def'
      }
    },
    additionalProperties: {
      $ref: '#/definitions/def'
    }
  }

  const object = {
    reg: {
      str: 'test'
    },
    obj: {
      str: 'test'
    }
  }

  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"reg":{"str":"test"},"obj":{"str":"test"}}')
})

test('ref external - pattern-additional Properties', (t) => {
  t.plan(2)

  const externalSchema = {
    first: require('./ref.json'),
    second: {
      definitions: {
        num: {
          type: 'object',
          properties: {
            int: {
              type: 'integer'
            }
          }
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref',
    type: 'object',
    properties: {},
    patternProperties: {
      reg: {
        $ref: 'first#/definitions/def'
      }
    },
    additionalProperties: {
      $ref: 'second#/definitions/num'
    }
  }

  const object = {
    reg: {
      str: 'test'
    },
    obj: {
      int: 42
    }
  }

  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"reg":{"str":"test"},"obj":{"int":42}}')
})

test('ref internal - deepObject schema', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        type: 'object',
        properties: {
          coming: {
            type: 'object',
            properties: {
              where: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    type: 'object',
    properties: {
      winter: {
        type: 'object',
        properties: {
          is: {
            $ref: '#/definitions/def'
          }
        }
      }
    }
  }

  const object = {
    winter: {
      is: {
        coming: {
          where: 'to town'
        }
      }
    }
  }

  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"winter":{"is":{"coming":{"where":"to town"}}}}')
})

test('ref internal - plain name fragment', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref',
    definitions: {
      def: {
        $id: '#uri',
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        },
        required: ['str']
      }
    },
    type: 'object',
    properties: {
      obj: {
        $ref: '#uri'
      }
    }
  }

  const object = {
    obj: {
      str: 'test'
    }
  }

  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('ref external - plain name fragment', (t) => {
  t.plan(2)

  const externalSchema = {
    first: {
      $id: '#first-schema',
      type: 'object',
      properties: {
        str: {
          type: 'string'
        }
      }
    },
    second: {
      definitions: {
        second: {
          $id: '#second-schema',
          type: 'object',
          properties: {
            int: {
              type: 'integer'
            }
          }
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref to external plain name fragment',
    type: 'object',
    properties: {
      first: {
        $ref: '#first-schema'
      },
      second: {
        $ref: '#second-schema'
      }
    }
  }

  const object = {
    first: {
      str: 'test'
    },
    second: {
      int: 42
    }
  }

  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"first":{"str":"test"},"second":{"int":42}}')
})

test('ref external - duplicate plain name fragment', (t) => {
  t.plan(2)

  const externalSchema = {
    external: {
      $id: '#duplicateSchema',
      type: 'object',
      properties: {
        prop: {
          type: 'boolean'
        }
      }
    },
    other: {
      $id: '#otherSchema',
      type: 'object',
      properties: {
        prop: {
          type: 'integer'
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref to plain name fragment',
    type: 'object',
    definitions: {
      duplicate: {
        $id: '#duplicateSchema',
        type: 'object',
        properties: {
          prop: {
            type: 'string'
          }
        }
      }
    },
    properties: {
      local: {
        $ref: '#duplicateSchema'
      },
      external: {
        $ref: 'external#duplicateSchema'
      },
      other: {
        $ref: '#otherSchema'
      }
    }
  }

  const object = {
    local: {
      prop: 'test'
    },
    external: {
      prop: true
    },
    other: {
      prop: 42
    }
  }

  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"local":{"prop":"test"},"external":{"prop":true},"other":{"prop":42}}')
})

test('ref external - explicit external plain name fragment must not fallback to other external schemas', (t) => {
  t.plan(1)

  const externalSchema = {
    first: {
      $id: '#target',
      type: 'object',
      properties: {
        prop: {
          type: 'string'
        }
      }
    },
    second: {
      $id: '#wrong',
      type: 'object',
      properties: {
        prop: {
          type: 'integer'
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref to plain name fragment',
    type: 'object',
    definitions: {
      third: {
        $id: '#wrong',
        type: 'object',
        properties: {
          prop: {
            type: 'boolean'
          }
        }
      }
    },
    properties: {
      target: {
        $ref: 'first#wrong'
      }
    }
  }

  const object = {
    target: {
      prop: 'test'
    }
  }

  try {
    const stringify = build(schema, { schema: externalSchema })
    const output = stringify(object)
    JSON.parse(output)
    t.fail()
  } catch (e) {
    t.pass()
  }
})

test('ref internal - multiple $ref format', (t) => {
  t.plan(2)

  const schema = {
    type: 'object',
    definitions: {
      one: {
        type: 'string',
        definitions: {
          two: {
            $id: '#twos',
            type: 'string'
          }
        }
      }
    },
    properties: {
      zero: {
        $id: '#three',
        type: 'string'
      },
      a: { $ref: '#/definitions/one' },
      b: { $ref: '#three' },
      c: { $ref: '#/properties/zero' },
      d: { $ref: '#twos' },
      e: { $ref: '#/definitions/one/definitions/two' }
    }
  }

  const object = {
    zero: 'test',
    a: 'test',
    b: 'test',
    c: 'test',
    d: 'test',
    e: 'test'
  }

  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"zero":"test","a":"test","b":"test","c":"test","d":"test","e":"test"}')
})

test('ref in root internal', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with $ref in root schema',
    $ref: '#/definitions/num',
    definitions: {
      num: {
        type: 'object',
        properties: {
          int: {
            $ref: '#/definitions/int'
          }
        }
      },
      int: {
        type: 'integer'
      }
    }
  }

  const object = { int: 42 }
  const stringify = build(schema)
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"int":42}')
})

test('ref in root external', (t) => {
  t.plan(2)

  const externalSchema = {
    numbers: {
      $id: 'numbers',
      definitions: {
        num: {
          type: 'object',
          properties: {
            int: {
              type: 'integer'
            }
          }
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref in root schema',
    type: 'object',
    $ref: 'numbers#/definitions/num'
  }

  const object = { int: 42 }
  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"int":42}')
})

test('ref in root external multiple times', (t) => {
  t.plan(2)

  const externalSchema = {
    numbers: {
      $id: 'numbers',
      $ref: 'subnumbers#/definitions/num'
    },
    subnumbers: {
      $id: 'subnumbers',
      definitions: {
        num: {
          type: 'object',
          properties: {
            int: {
              type: 'integer'
            }
          }
        }
      }
    }
  }

  const schema = {
    title: 'object with $ref in root schema',
    type: 'object',
    $ref: 'numbers#/definitions/num'
  }

  const object = { int: 42 }
  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"int":42}')
})

test('ref external to relative definition', (t) => {
  t.plan(2)

  const externalSchema = {
    'relative:to:local': {
      $id: 'relative:to:local',
      type: 'object',
      properties: {
        foo: { $ref: '#/definitions/foo' }
      },
      definitions: {
        foo: { type: 'string' }
      }
    }
  }

  const schema = {
    type: 'object',
    required: ['fooParent'],
    properties: {
      fooParent: { $ref: 'relative:to:local' }
    }
  }

  const object = { fooParent: { foo: 'bar' } }
  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"fooParent":{"foo":"bar"}}')
})

test('ref to nested ref definition', (t) => {
  t.plan(2)

  const externalSchema = {
    'a:b:c1': {
      $id: 'a:b:c1',
      type: 'object',
      definitions: {
        foo: { $ref: 'a:b:c2#/definitions/foo' }
      }
    },
    'a:b:c2': {
      $id: 'a:b:c2',
      type: 'object',
      definitions: {
        foo: { type: 'string' }
      }
    }
  }

  const schema = {
    type: 'object',
    required: ['foo'],
    properties: {
      foo: { $ref: 'a:b:c1#/definitions/foo' }
    }
  }

  const object = { foo: 'foo' }
  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"foo":"foo"}')
})

test('ref in definition with exact match', (t) => {
  t.plan(2)

  const externalSchema = {
    '#/definitions/foo': {
      type: 'string'
    }
  }

  const schema = {
    type: 'object',
    properties: {
      foo: { $ref: '#/definitions/foo' }
    }
  }

  const object = { foo: 'foo' }
  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(output, '{"foo":"foo"}')
})

test('Bad key', t => {
  t.test('Find match', t => {
    t.plan(1)
    try {
      build({
        definitions: {
          projectId: {
            type: 'object',
            properties: {
              id: { type: 'integer' }
            }
          }
        },
        type: 'object',
        properties: {
          data: {
            $ref: '#/definitions/porjectId'
          }
        }
      })
      t.fail('Should throw')
    } catch (err) {
      t.is(err.message, 'Cannot find reference "porjectId", did you mean "projectId"?')
    }
  })

  t.test('No match', t => {
    t.plan(1)
    try {
      build({
        definitions: {
          projectId: {
            type: 'object',
            properties: {
              id: { type: 'integer' }
            }
          }
        },
        type: 'object',
        properties: {
          data: {
            $ref: '#/definitions/foobar'
          }
        }
      })
      t.fail('Should throw')
    } catch (err) {
      t.is(err.message, 'Cannot find reference "foobar"')
    }
  })

  t.test('Find match (external schema)', t => {
    t.plan(1)
    try {
      build({
        type: 'object',
        properties: {
          data: {
            $ref: 'external#/definitions/porjectId'
          }
        }
      }, {
        schema: {
          external: {
            definitions: {
              projectId: {
                type: 'object',
                properties: {
                  id: { type: 'integer' }
                }
              }
            }
          }
        }
      })
      t.fail('Should throw')
    } catch (err) {
      t.is(err.message, 'Cannot find reference "porjectId", did you mean "projectId"?')
    }
  })

  t.test('No match (external schema)', t => {
    t.plan(1)
    try {
      build({
        type: 'object',
        properties: {
          data: {
            $ref: 'external#/definitions/foobar'
          }
        }
      }, {
        schema: {
          external: {
            definitions: {
              projectId: {
                type: 'object',
                properties: {
                  id: { type: 'integer' }
                }
              }
            }
          }
        }
      })
      t.fail('Should throw')
    } catch (err) {
      t.is(err.message, 'Cannot find reference "foobar"')
    }
  })

  t.test('Find match (external definitions typo)', t => {
    t.plan(1)
    try {
      build({
        type: 'object',
        properties: {
          data: {
            $ref: 'external#/deifnitions/projectId'
          }
        }
      }, {
        schema: {
          external: {
            definitions: {
              projectId: {
                type: 'object',
                properties: {
                  id: { type: 'integer' }
                }
              }
            }
          }
        }
      })
      t.fail('Should throw')
    } catch (err) {
      t.is(err.message, 'Cannot find reference "deifnitions", did you mean "definitions"?')
    }
  })

  t.test('Find match (definitions typo)', t => {
    t.plan(1)
    try {
      build({
        definitions: {
          projectId: {
            type: 'object',
            properties: {
              id: { type: 'integer' }
            }
          }
        },
        type: 'object',
        properties: {
          data: {
            $ref: '#/deifnitions/projectId'
          }
        }
      })
      t.fail('Should throw')
    } catch (err) {
      t.is(err.message, 'Cannot find reference "deifnitions", did you mean "definitions"?')
    }
  })

  t.test('Find match (external schema typo)', t => {
    t.plan(1)
    try {
      build({
        type: 'object',
        properties: {
          data: {
            $ref: 'extrenal#/definitions/projectId'
          }
        }
      }, {
        schema: {
          external: {
            definitions: {
              projectId: {
                type: 'object',
                properties: {
                  id: { type: 'integer' }
                }
              }
            }
          }
        }
      })
      t.fail('Should throw')
    } catch (err) {
      t.is(err.message, 'Cannot find reference "extrenal", did you mean "external"?')
    }
  })

  t.end()
})
