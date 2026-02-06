'use strict'

const { test } = require('node:test')
const build = require('..')

// Covers issue #139
test('Should throw on invalid schema', t => {
  t.plan(1)
  t.assert.throws(() => {
    build({}, {
      schema: {
        invalid: {
          type: 'Dinosaur'
        }
      }
    })
  }, { message: /^"invalid" schema is invalid:.*/ })
})

test('invalid not schema', (t) => {
  t.plan(1)

  const schema = {
    type: 'object',
    properties: {
      prop: {
        not: 'not object'  // invalid, not must be object
      }
    }
  }

  try {
    build(schema)
    t.assert.fail('Should throw')
  } catch (err) {
    t.assert.ok(err.message.includes('schema is invalid'))
  }
})
