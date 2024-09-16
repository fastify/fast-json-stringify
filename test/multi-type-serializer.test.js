'use strict'

const { describe } = require('node:test')
const { throws } = require('node:assert')
const build = require('..')

describe('should throw a TypeError with the path to the key of the invalid value', (t) => {
  const schema = {
    type: 'object',
    properties: {
      num: {
        type: ['number']
      }
    }
  }

  const stringify = build(schema)
  throws(() => stringify({ num: { bla: 123 } }), new TypeError('The value of \'#/properties/num\' does not match schema definition.'))
})
