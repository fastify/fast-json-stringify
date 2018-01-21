'use strict'

const test = require('tap').test
const build = require('..')

test('Cannot be coerced to integer', t => {
  const values = [ true, false, null, Infinity, -Infinity, NaN, {}, '', '55 foobar', [], [5] ]
  t.plan(values.length)

  const serializer = build({
    type: 'object',
    properties: {
      my_int: { type: 'integer' }
    }
  })

  values.forEach(function (v) {
    try {
      serializer({ my_int: v })
      t.fail()
    } catch (e) {
      t.equal(e.message, 'Cannot coerce to number')
    }
  })
})

test('Cannot be coerced to boolean', t => {
  const values = [ 0, 42, -55.5, null, Infinity, -Infinity, NaN, {}, '', '55 foobar', [], [5] ]
  t.plan(values.length)

  const serializer = build({
    type: 'object',
    properties: {
      my_int: { type: 'boolean' }
    }
  })

  values.forEach(function (v) {
    try {
      serializer({ my_int: v })
      t.fail()
    } catch (e) {
      t.equal(e.message, 'Cannot coerce to boolean')
    }
  })
})
