'use strict'

const test = require('tap').test
const build = require('..')

test('Should clean the cache', (t) => {
  t.plan(1)

  const schema = {
    $id: 'test',
    type: 'string'
  }

  try {
    build(schema)
    build(schema)
    t.pass()
  } catch (err) {
    t.fail(err)
  }
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

  try {
    build(schema)
    build(schema)
    t.pass()
  } catch (err) {
    t.fail(err)
  }
})
