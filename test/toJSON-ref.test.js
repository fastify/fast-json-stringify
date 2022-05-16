'use strict'

const test = require('tap').test
const build = require('..')

const object = {
  props: {
    obj: {
      toJSON () { return { str: 'test' } }
    }
  },
  toJSON () {
    return { obj: this.props.obj }
  }
}

test('toJSON - ref - properties', (t) => {
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

  const stringify = build(schema)
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('toJSON - ref - items', (t) => {
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

  const arrayObj = {
    props: {
      str: {
        toJSON () { return { str: 'test' } }
      }
    },
    toJSON () { return [this.props.str] }
  }

  const stringify = build(schema)
  const output = stringify(arrayObj)

  JSON.parse(output)
  t.pass()

  t.equal(output, '[{"str":"test"}]')
})

test('toJSON - ref - patternProperties', (t) => {
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

  const stringify = build(schema)
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('toJSON - ref - additionalProperties', (t) => {
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

  const stringify = build(schema)
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"obj":{"str":"test"}}')
})

test('toJSON - ref - pattern-additional Properties', (t) => {
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
    props: {
      patternObj: {
        toJSON () { return { str: 'test' } }
      }
    },
    toJSON () {
      return {
        reg: this.props.patternObj,
        obj: this.props.patternObj
      }
    }
  }

  const stringify = build(schema)
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"reg":{"str":"test"},"obj":{"str":"test"}}')
})

test('toJSON - ref - deepObject schema', (t) => {
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

  const where = {
    toJSON () { return 'to town' }
  }
  const coming = {
    toJSON () { return { where } }
  }
  const is = {
    toJSON () { return { coming } }
  }
  const winter = {
    toJSON () { return { is } }
  }
  const object = {
    toJSON () { return { winter } }
  }

  const stringify = build(schema)
  const output = stringify(object)

  JSON.parse(output)
  t.pass()

  t.equal(output, '{"winter":{"is":{"coming":{"where":"to town"}}}}')
})

test('toJSON - ref - Regression 2.5.2', t => {
  t.plan(1)

  const externalSchema = {
    '/models/Bar': {
      $id: '/models/Bar',
      $schema: 'http://json-schema.org/schema#',
      definitions: {
        entity: {
          type: 'object',
          properties: { field: { type: 'string' } }
        }
      }
    },
    '/models/Foo': {
      $id: '/models/Foo',
      $schema: 'http://json-schema.org/schema#',
      definitions: {
        entity: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            sub: {
              oneOf: [
                { $ref: '/models/Bar#/definitions/entity' },
                { type: 'null' }
              ]
            }
          }
        }
      }
    }
  }

  const schema = {
    type: 'array',
    items: {
      $ref: '/models/Foo#/definitions/entity'
    }
  }

  const object = {
    props: {
      field: {
        toJSON () { return 'parent' }
      },
      sub: {
        toJSON () { return { field: 'joined' } }
      }
    },
    toJSON () {
      return [{
        field: this.props.field,
        sub: this.props.sub
      }]
    }
  }

  const stringify = build(schema, { schema: externalSchema })
  const output = stringify(object)

  t.equal(output, '[{"field":"parent","sub":{"field":"joined"}}]')
})
