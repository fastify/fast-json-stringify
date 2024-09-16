'use strict'

const { describe } = require('node:test')
const { throws } = require('node:assert')
const build = require('..')

describe('sanitize 4', () => {
  const payload = '(throw "pwoned")'

  const stringify = build({
    required: [`"];${payload}//`]
  })

  throws(() => {
    stringify({})
  }, { message: '""];(throw "pwoned")//" is required!' })
})
