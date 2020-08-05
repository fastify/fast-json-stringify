'use strict'

const test = require('tap').test
const build = require('..')

test('Should clean the cache', (t) => {
  t.plan(1)

  const schema = {
    $id: 'test',
    type: 'string'
  }

  build(schema)
  build(schema)
  t.pass()
})

test('Should clean the cache with external schemas', (t) => {
  t.plan(1)

  const schema = {
    $id: 'test',
    definitions: {
      def: {
        type: 'object',
        properties: {
          str: {
            type: 'string'
          }
        }
      }
    },
    type: 'object',
    properties: {
      obj: {
        $ref: '#/definitions/def'
      }
    }
  }

  build(schema)
  build(schema)
  t.pass()
})
