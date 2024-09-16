'use strict'

const { describe, it } = require('node:test')
const { throws } = require('node:assert')
const build = require('..')

// Covers issue #139
describe('Invalid schema', () => {
  it('Should throw on invalid schema', () => {
    throws(() => {
      build({}, {
        schema: {
          invalid: {
            type: 'Dinosaur'
          }
        }
      })
    }, {
      message: /^"invalid" schema is invalid:.*/
    })
  })
})
