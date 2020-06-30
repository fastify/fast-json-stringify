'use strict'

const t = require('tap')
const build = require('..')

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

t.pass('no crashes')
