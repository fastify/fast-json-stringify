'use strict'

const { describe } = require('node:test')
const { equal } = require('node:assert')
const build = require('..')

describe('nested object in pattern properties for typebox', (t) => {
  const { Type } = require('@sinclair/typebox')

  const nestedSchema = Type.Object({
    nestedKey1: Type.String()
  })

  const RootSchema = Type.Object({
    key1: Type.Record(Type.String(), nestedSchema),
    key2: Type.Record(Type.String(), nestedSchema)
  })

  const schema = RootSchema
  const stringify = build(schema)

  const value = stringify({
    key1: {
      nestedKey: {
        nestedKey1: 'value1'
      }
    },
    key2: {
      nestedKey: {
        nestedKey1: 'value2'
      }
    }
  })
  equal(value, '{"key1":{"nestedKey":{"nestedKey1":"value1"}},"key2":{"nestedKey":{"nestedKey1":"value2"}}}')
})
