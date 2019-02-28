'use strict'

const test = require('tap').test
const build = require('..')

// Covers issue #139
test('Should throw on invalid schema', t => {
  t.plan(2)
  try {
    build({}, {
      schema: {
        invalid: {
          type: 'Dinosaur'
        }
      }
    })
    t.fail('should be an invalid schema')
  } catch (err) {
    t.match(err.message, /^"invalid" schema is invalid:.*/, 'Schema contains invalid key')
    t.ok(err)
  }
})
