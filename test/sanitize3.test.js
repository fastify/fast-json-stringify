'use strict'

const { describe } = require('node:test')
const { throws } = require('node:assert')
const build = require('..')

describe('sanitize 3', () => {
  throws(() => {
    build({
      $defs: {
        type: 'foooo"bar'
      },
      patternProperties: {
        x: { $ref: '#/$defs' }
      }
    })
  }, { message: 'foooo"bar unsupported' })
})
