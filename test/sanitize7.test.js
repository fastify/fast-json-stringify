'use strict'

const test = require('tap').test
const build = require('..')

test('required property containing single quote, contains property', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      '\'': { type: 'string' }
    },
    required: [
      '\''
    ]
  })

  t.throws(() => stringify({}), new Error('"\'" is required!'))
})
