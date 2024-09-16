'use strict'

const { describe } = require('node:test')
const { deepStrictEqual, ok, throws } = require('node:assert')
const validator = require('is-my-json-valid')
const build = require('..')

function buildTest (schema, toStringify) {
  describe(`render a ${schema.title} as JSON`, () => {
    const validate = validator(schema)
    const stringify = build(schema)
    const output = stringify(toStringify)

    deepStrictEqual(JSON.parse(output), toStringify)
    deepStrictEqual(output, JSON.stringify(toStringify))
    ok(validate(JSON.parse(output)), 'valid schema')
  })
}

buildTest({
  title: 'string',
  type: 'string',
  format: 'unsafe'
}, 'hello world')

buildTest({
  title: 'basic',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    },
    lastName: {
      type: 'string'
    },
    age: {
      description: 'Age in years',
      type: 'integer',
      minimum: 0
    },
    magic: {
      type: 'number'
    }
  },
  required: ['firstName', 'lastName']
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
  title: 'deep',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    },
    lastName: {
      type: 'string'
    },
    more: {
      description: 'more properties',
      type: 'object',
      properties: {
        something: {
          type: 'string'
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
  title: 'null',
  type: 'null'
}, null)

buildTest({
  title: 'deep object with weird keys',
  type: 'object',
  properties: {
    '@version': {
      type: 'integer'
    }
  }
}, {
  '@version': 1
})

buildTest({
  title: 'deep object with weird keys of type object',
  type: 'object',
  properties: {
    '@data': {
      type: 'object',
      properties: {
        id: {
          type: 'string'
        }
      }
    }
  }
}, {
  '@data': {
    id: 'string'
  }
})

buildTest({
  title: 'deep object with spaces in key',
  type: 'object',
  properties: {
    'spaces in key': {
      type: 'object',
      properties: {
        something: {
          type: 'integer'
        }
      }
    }
  }
}, {
  'spaces in key': {
    something: 1
  }
})

buildTest({
  title: 'with null',
  type: 'object',
  properties: {
    firstName: {
      type: 'null'
    }
  }
}, {
  firstName: null
})

buildTest({
  title: 'array with objects',
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: {
        type: 'string'
      }
    }
  }
}, [{
  name: 'Matteo'
}, {
  name: 'Dave'
}])

buildTest({
  title: 'array with strings',
  type: 'array',
  items: {
    type: 'string'
  }
}, [
  'Matteo',
  'Dave'
])

buildTest({
  title: 'array with numbers',
  type: 'array',
  items: {
    type: 'number'
  }
}, [
  42.42,
  24
])

buildTest({
  title: 'array with integers',
  type: 'array',
  items: {
    type: 'number'
  }
}, [
  42,
  24
])

buildTest({
  title: 'nested array with objects',
  type: 'object',
  properties: {
    data: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string'
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
  title: 'object with boolean',
  type: 'object',
  properties: {
    readonly: {
      type: 'boolean'
    }
  }
}, {
  readonly: true
})

describe('throw an error or coerce numbers and integers that are not numbers', (t) => {
  const stringify = build({
    title: 'basic',
    type: 'object',
    properties: {
      age: {
        type: 'number'
      },
      distance: {
        type: 'integer'
      }
    }
  })

  try {
    stringify({ age: 'hello  ', distance: 'long' })
    t.fail('should throw an error')
  } catch (err) {
    ok(err)
  }

  const result = stringify({
    age: '42',
    distance: true
  })

  deepStrictEqual(JSON.parse(result), { age: 42, distance: 1 })
})

describe('Should throw on invalid schema', t => {
  try {
    build({
      type: 'Dinosaur',
      properties: {
        claws: { type: 'sharp' }
      }
    })
    t.fail('should be an invalid schema')
  } catch (err) {
    ok(err)
  }
})

describe('additionalProperties - throw on unknown type', () => {
  throws(() => {
    build({
      title: 'check array coerce',
      type: 'object',
      properties: {},
      additionalProperties: {
        type: 'strangetype'
      }
    })
  }, { message: 'schema is invalid: data/additionalProperties/type must be equal to one of the allowed values' })
})

describe('patternProperties - throw on unknown type', (t) => {
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
    ok(err)
  }
})

describe('render a double quote as JSON /1', () => {
  const schema = {
    type: 'string'
  }
  const toStringify = '" double quote'

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  deepStrictEqual(output, JSON.stringify(toStringify))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a double quote as JSON /2', () => {
  const schema = {
    type: 'string'
  }
  const toStringify = 'double quote " 2'

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  deepStrictEqual(output, JSON.stringify(toStringify))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('render a long string', () => {
  const schema = {
    type: 'string'
  }
  const toStringify = 'the Ultimate Question of Life, the Universe, and Everything.'

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  deepStrictEqual(output, JSON.stringify(toStringify))
  ok(validate(JSON.parse(output)), 'valid schema')
})

describe('returns JSON.stringify if schema type is boolean', t => {
  const schema = {
    type: 'array',
    items: true
  }

  const array = [1, true, 'test']
  const stringify = build(schema)
  deepStrictEqual(stringify(array), JSON.stringify(array))
})
