'use strict'

const test = require('tap').test
const build = require('..')

const { Type } = require('@sinclair/typebox')

test('nested object in pattern properties for typebox', (t) => {
  t.plan(1)

  const nestedSchema = Type.Object({
    text: Type.String()
  })

  const RootSchema = Type.Object({
    object1: Type.Record(Type.String(), nestedSchema),
    object2: Type.Record(Type.String(), nestedSchema)
  })
  const schema = RootSchema
  const stringify = build(schema)

  const value = stringify({
    object1: {
      A: {
        text: 'text1'
      },
      B: {
        text: 'text2'
      },
      C: {
        text: 'text3'
      }
    },
    object2: {
      D: {
        text: 'text4'
      },
      E: {
        text: 'text5'
      }
    }
  })
  t.equal(value, '{"object1":{"A":{"text":"text1"},"B":{"text":"text2"},"C":{"text":"text3"}},"object2":{"D":{"text":"text4"},"E":{"text":"text5"}}}')
})
