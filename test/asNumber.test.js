'use strict'

const { describe } = require('node:test')
const { deepStrictEqual } = require('node:assert')

describe('asNumber should convert BigInt', () => {
  const Serializer = require('../lib/serializer')
  const serializer = new Serializer()

  const number = serializer.asNumber(11753021440n)

  deepStrictEqual(number, '11753021440')
})
