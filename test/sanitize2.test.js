'use strict'

const t = require('tap')
const build = require('..')

const payload = '(throw "pwoned")'

const stringify = build({
  properties: {
    [`*///\\\\\\']);${payload};{/*`]: {
      type: 'number'
    }
  }
})

stringify({})

t.pass('no crashes')
