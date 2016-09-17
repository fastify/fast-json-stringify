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

test('render a a date in a string as JSON', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string'
  }
  const toStringify = new Date()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
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

test('object with RexExp', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with RegExp',
    type: 'object',
    properties: {
      reg: {
        type: 'string'
      }
    }
  }

  const obj = {
    reg: /"([^"]|\\")*"/
  }

  const stringify = build(schema)
  const validate = validator(schema)
  const output = stringify(obj)

  try {
    JSON.parse(output)
    t.pass()
  } catch (e) {
    t.fail()
  }

  t.equal(obj.reg.source, new RegExp(JSON.parse(output).reg).source)
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('object with required field', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'integer'
      }
    },
    required: ['str']
  }
  const stringify = build(schema)

  try {
    stringify({
      str: 'string'
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  try {
    stringify({
      num: 42
    })
    t.fail()
  } catch (e) {
    t.is(e.message, 'str is required!')
    t.pass()
  }
})

test('missing values', (t) => {
  t.plan(3)

  const stringify = build({
    title: 'object with missing values',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'number'
      },
      val: {
        type: 'string'
      }
    }
  })

  t.equal('{"val":"value"}', stringify({ val: 'value' }))
  t.equal('{"str":"string","val":"value"}', stringify({ str: 'string', val: 'value' }))
  t.equal('{"str":"string","num":42,"val":"value"}', stringify({ str: 'string', num: 42, val: 'value' }))
})
