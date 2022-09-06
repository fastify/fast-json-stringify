'use strict'

const t = require('tap')
const build = require('..')

t.throws(() => {
  build({
    $defs: {
      type: 'foooo"bar'
    },
    patternProperties: {
      x: { $ref: '#/$defs' }
    }
  })
}, 'foooo"bar unsupported')
