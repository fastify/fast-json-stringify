'use strict'

const t = require('tap')
const build = require('..')

const stringify = build({
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
      description: 'Age in years"',
      type: 'integer'
    },
    [(() => `phra'&& process.exit(1) ||'phra`)()]: {},
    now: {
      type: 'string'
    },
    reg: {
      type: 'string',
      default: 'a\'&& process.exit(1) ||\''
    },
    obj: {
      type: 'object',
      properties: {
        bool: {
          type: 'boolean'
        }
      }
    },
    '"\'w00t': {
      type: 'string',
      default: '"\'w00t'
    },
    arr: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          'phra\' && process.exit(1)//': {
            type: 'number'
          },
          str: {
            type: 'string'
          }
        }
      }
    }
  },
  required: ['now'],
  patternProperties: {
    '.*foo$': {
      type: 'string'
    },
    'test': {
      type: 'number'
    },
    'phra\'/ && process.exit(1) && /\'': {
      type: 'number'
    }
  },
  additionalProperties: {
    type: 'string'
  }
})

const obj = {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32,
  now: new Date(),
  foo: 'hello"',
  bar: "world'",
  'fuzz"': 42,
  "me'": 42,
  numfoo: 42,
  test: 42,
  strtest: '23',
  arr: [{ 'phra\' && process.exit(1)//': 42 }],
  obj: { bool: true },
  notmatch: 'valar morghulis',
  notmatchobj: { a: true },
  notmatchnum: 42
}

// pass if it does not crash
JSON.parse(stringify(obj))

t.pass('no crashes')
