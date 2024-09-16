'use strict'

const { describe } = require('node:test')
const build = require('..')

describe('sanitize 6', () => {
  const payload = '(throw "pwoned")'

  const stringify = build({
    type: 'object',
    properties: {
      '/*': { type: 'object' },
      x: {
        type: 'object',
        properties: {
          a: { type: 'string', default: `*/}${payload};{//` }
        }
      }
    }
  })
  stringify({})
})
