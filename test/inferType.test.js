'use strict'

const test = require('tap').test
const validator = require('is-my-json-valid')
const build = require('..')

function buildTest (schema, toStringify) {
  test(`render a ${schema.title} as JSON`, (t) => {
    t.plan(5)

    const validate = validator(schema)
    const stringify = build(schema)
    const stringifyUgly = build(schema, { uglify: true })
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
  title: 'infer type object by keyword',
  // 'type': 'object',
  properties: {
    name: {
      type: 'string'
    }
  }
}, {
  name: 'foo'
})

buildTest({
  title: 'infer type of nested object by keyword',
  // 'type': 'object',
  properties: {
    more: {
      description: 'more properties',
      // 'type': 'object',
      properties: {
        something: {
          type: 'string'
        }
      }
    }
  }
}, {
  more: {
    something: 'else'
  }
})

buildTest({
  title: 'infer type array by keyword',
  type: 'object',
  properties: {
    ids: {
      // 'type': 'array',
      items: {
        type: 'string'
      }
    }
  }
}, {
  ids: ['test']
})

buildTest({
  title: 'infer type string by keyword',
  type: 'object',
  properties: {
    name: {
      // 'type': 'string',
      maxLength: 3
    }
  }
}, {
  name: 'foo'
})

buildTest({
  title: 'infer type number by keyword',
  type: 'object',
  properties: {
    age: {
      // 'type': 'number',
      maximum: 18
    }
  }
}, {
  age: 18
})
