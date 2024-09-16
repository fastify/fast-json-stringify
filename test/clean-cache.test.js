'use strict'

const { describe } = require('node:test')
const { doesNotThrow } = require('node:assert')
const build = require('..')

describe('Should clean the cache', () => {
  const schema = {
    $id: 'test',
    type: 'string'
  }

  doesNotThrow(() => build(schema))
  doesNotThrow(() => build(schema))
})

describe('Should clean the cache with external schemas', () => {
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

  doesNotThrow(() => build(schema))
  doesNotThrow(() => build(schema))
})
