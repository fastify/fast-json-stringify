'use strict'

const fastJson = require('.')
const stringify = fastJson({
  title: 'Example Schema',
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
      type: 'integer'
    },
    now: {
      type: 'string'
    },
    reg: {
      type: 'string'
    }
  },
  required: ['now'],
  patternProperties: {
    '.*foo$': {
      type: 'string'
    },
    'test': {
      type: 'number'
    }
  }
})

console.log(stringify({
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32,
  now: new Date(),
  reg: /"([^"]|\\")*"/,
  foo: 'hello',
  numfoo: 42,
  test: 42,
  strtest: '23'
}))
