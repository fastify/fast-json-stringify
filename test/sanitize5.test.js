'use strict'

const t = require('tap')
const build = require('..')

const payload = '(throw "pwoned")'

const expected = 'Error: Invalid regular expression: /*/: Nothing to repeat. Found at * matching {"type":"*/(throw \\"pwoned\\")){//"}'

t.throws(() => {
  build({
    patternProperties: {
      '*': { type: `*/${payload}){//` }
    }
  })
}, expected)
