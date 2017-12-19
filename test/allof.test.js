'use strict'

const test = require('tap').test
const build = require('..')

test('object with multiple types field', (t) => {
  t.plan(2)

  const schema = {
    title: 'object with multiple types field',
    type: 'object',
    allOf: [
      {
        type: 'object',
        required: [
          'name'
        ],
        properties: {
          name: {
            type: 'string'
          },
          tag: {
            type: 'string'
          }
        }
      },
      {
        required: [
          'id'
        ],
        type: 'object',
        properties: {
          id: {
            type: 'integer'
          }
        }
      }
    ]
  }
  const stringify = build(schema)

  try {
    const value = stringify({
      id: 1,
      name: 'string'
    })
    t.is(value, '{"id":1,"name":"string"}')
  } catch (e) {
    t.fail()
  }

  try {
    const value = stringify({
      id: 1,
      name: 'string',
      tag: 'otherString'
    })
    t.is(value, '{"id":1,"name":"string","tag":"otherString"}')
  } catch (e) {
    t.fail()
  }
})
