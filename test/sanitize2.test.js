'use strict'

const { describe } = require('node:test')
const build = require('..')

describe('sanitize 2', () => {
  const payload = '(throw "pwoned")'

  const stringify = build({
    properties: {
      [`*///\\\\\\']);${payload};{/*`]: {
        type: 'number'
      }
    }
  })

  stringify({})
})
