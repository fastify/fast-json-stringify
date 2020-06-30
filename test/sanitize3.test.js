'use strict'

const t = require('tap')
const build = require('..')

const stringify = build({
  $defs: {
    type: 'foooo"bar'
  },
  patternProperties: {
    x: { $ref: '#/$defs' }
  }
})

t.throws(() => {
  stringify({ x: 0 })
}, 'Cannot coerce 0 to "foo"bar"')
