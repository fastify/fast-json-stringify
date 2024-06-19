'use strict'

const test = require('tap').test

test('asNumber should convert BigInt', (t) => {
  t.plan(1)
  const Serializer = require('../lib/serializer')
  const serializer = new Serializer()

  const number = serializer.asNumber(11753021440n)

  t.equal(number, '11753021440')
})
