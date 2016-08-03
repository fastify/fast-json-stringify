'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('.')

function buildTest (schema, toStringify) {
  test(`render a ${schema.title} as JSON`, (t) => {
    t.plan(3)

    const validate = validator(schema)
    const stringify = build(schema)
    const output = stringify(toStringify)

    t.deepEqual(JSON.parse(output), toStringify)
    t.equal(output, JSON.stringify(toStringify))
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
