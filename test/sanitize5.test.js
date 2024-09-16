'use strict'

const { describe } = require('node:test')
const { throws } = require('node:assert')
const build = require('..')

describe('sanitize 5', () => {
  const payload = '(throw "pwoned")'

  throws(() => {
    build({
      patternProperties: {
        '*': { type: `*/${payload}){//` }
      }
    })
  }, { message: 'schema is invalid: data/patternProperties must match format "regex"' })
})
