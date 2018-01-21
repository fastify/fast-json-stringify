'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('..')

function buildTest (schema, toStringify) {
  test(`render a ${schema.title} as JSON`, (t) => {
    t.plan(5)

    const validate = validator(schema)
    const stringify = build(schema)
    const stringifyUgly = build(schema, {uglify: true})
    const output = stringify(toStringify)
    const outputUglify = stringifyUgly(toStringify)

    t.deepEqual(JSON.parse(output), toStringify)
    t.deepEqual(JSON.parse(outputUglify), toStringify)
    t.equal(output, JSON.stringify(toStringify))
    t.equal(outputUglify, JSON.stringify(toStringify))
    t.ok(validate(JSON.parse(output)), 'valid schema')
  })
}

buildTest({
  'title': 'basic',
  'type': 'object',
  'properties': {
    'firstName': {
      'type': 'string'
    },
    'lastName': {
      'type': 'string'
    },
    'age': {
      'description': 'Age in years',
      'type': 'integer',
      'minimum': 0
    },
    'magic': {
      'type': 'number'
    }
  },
  'required': ['firstName', 'lastName']
}, {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32,
  magic: 42.42
})

buildTest({
  title: 'string',
  type: 'string'
}, 'hello world')

buildTest({
  title: 'string',
  type: 'string'
}, 'hello\nworld')

buildTest({
  title: 'string with quotes',
  type: 'string'
}, 'hello """" world')

buildTest({
  title: 'boolean true',
  type: 'boolean'
}, true)

buildTest({
  title: 'boolean false',
  type: 'boolean'
}, false)

buildTest({
  title: 'an integer',
  type: 'integer'
}, 42)

buildTest({
  title: 'a number',
  type: 'number'
}, 42.42)

buildTest({
  'title': 'deep',
  'type': 'object',
  'properties': {
    'firstName': {
      'type': 'string'
    },
    'lastName': {
      'type': 'string'
    },
    'more': {
      'description': 'more properties',
      'type': 'object',
      'properties': {
        'something': {
          'type': 'string'
        }
      }
    }
  }
}, {
  firstName: 'Matteo',
  lastName: 'Collina',
  more: {
    something: 'else'
  }
})

buildTest({
  'title': 'null',
  'type': 'null'
}, null)

buildTest({
  'title': 'deep object with weird keys',
  'type': 'object',
  'properties': {
    '@version': {
      'type': 'integer'
    }
  }
}, {
  '@version': 1
})

buildTest({
  'title': 'deep object with spaces in key',
  'type': 'object',
  'properties': {
    'spaces in key': {
      'type': 'object',
      'properties': {
        'something': {
          'type': 'integer'
        }
      }
    }
  }
}, {
  'spaces in key': {
    'something': 1
  }
})

buildTest({
  'title': 'with null',
  'type': 'object',
  'properties': {
    'firstName': {
      'type': 'null'
    }
  }
}, {
  firstName: null
})

buildTest({
  'title': 'array with objects',
  'type': 'array',
  'items': {
    'type': 'object',
    'properties': {
      'name': {
        'type': 'string'
      }
    }
  }
}, [{
  name: 'Matteo'
}, {
  name: 'Dave'
}])

buildTest({
  'title': 'array with strings',
  'type': 'array',
  'items': {
    'type': 'string'
  }
}, [
  'Matteo',
  'Dave'
])

buildTest({
  'title': 'array with numbers',
  'type': 'array',
  'items': {
    'type': 'number'
  }
}, [
  42.42,
  24
])

buildTest({
  'title': 'array with integers',
  'type': 'array',
  'items': {
    'type': 'number'
  }
}, [
  42,
  24
])

buildTest({
  'title': 'nested array with objects',
  'type': 'object',
  'properties': {
    'data': {
      'type': 'array',
      'items': {
        'type': 'object',
        'properties': {
          'name': {
            'type': 'string'
          }
        }
      }
    }
  }
}, {
  data: [{
    name: 'Matteo'
  }, {
    name: 'Dave'
  }]
})

buildTest({
  'title': 'object with boolean',
  'type': 'object',
  'properties': {
    'readonly': {
      'type': 'boolean'
    }
  }
}, {
  readonly: true
})

test('booleans are coerced to integer', t => {
  t.plan(2)
  const serializer = build({
    type: 'object',
    properties: {
      claws: { type: 'integer' }
    }
  })
  const s1 = serializer({ claws: true })
  t.equal(s1, '{"claws":1}')

  const s2 = serializer({ claws: false })
  t.equal(s2, '{"claws":0}')
})

test('Should throw on invalid schema', t => {
  t.plan(1)
  try {
    build({
      type: 'Dinosaur',
      properties: {
        claws: { type: 'sharp' }
      }
    })
    t.fail('should be an invalid schema')
  } catch (err) {
    t.ok(err)
  }
})

test('Should throw if no integer is provided', t => {
  t.plan(2)
  const serializer = build({
    type: 'object',
    properties: {
      my_int: { type: 'integer' }
    }
  })
  try {
    serializer({
      my_int: 'this is not an integer at all!'
    })
    t.fail('should be an invalid schema')
  } catch (err) {
    t.ok(err)
    t.ok(err.message, 'Cannot coerce to number')
  }
})

test('additionalProperties - throw on unknown type', (t) => {
  t.plan(1)

  try {
    build({
      title: 'check array coerce',
      type: 'object',
      properties: {},
      additionalProperties: {
        type: 'strangetype'
      }
    })
    t.fail('should be an invalid schema')
  } catch (err) {
    t.ok(err)
  }
})

test('patternProperties - throw on unknown type', (t) => {
  t.plan(1)

  try {
    build({
      title: 'check array coerce',
      type: 'object',
      properties: {},
      patternProperties: {
        foo: {
          type: 'strangetype'
        }
      }
    })
    t.fail('should be an invalid schema')
  } catch (err) {
    t.ok(err)
  }
})
