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

  t.equal('{"obj":{"str":"test"}}', output)
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
      }
    }
  }

  const object = {
    obj: {
      str: 'test'
    },
    num: {
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

  t.equal('{"obj":{"str":"test"},"num":{"int":42}}', output)
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

  t.equal('{"obj":{"str":"test"}}', output)
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

  t.equal('{"obj":{"str":"test"}}', output)
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

  t.equal('{"reg":{"str":"test"},"obj":{"str":"test"}}', output)
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

  t.equal('{"reg":{"str":"test"},"obj":{"int":42}}', output)
})
