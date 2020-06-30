'use strict'

const t = require('tap')
const build = require('..')

const payload = '(throw "pwoned")'

const stringify = build({
  required: [`"];${payload}//`]
})

t.throws(() => {
  stringify({})
}, 'Error: ""];(throw "pwoned")//" is required!')
