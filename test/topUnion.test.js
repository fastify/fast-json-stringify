'use strict'

const test = require('tap').test
const build = require('..')

test('top level union type', (t) => {
  const stringify = build({
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              nullable: false
            },
            name: {
              type: 'string',
              nullable: true
            }
          },
          nullable: false
        },
        {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              nullable: false
            },
            email: {
              type: 'string',
              nullable: false
            }
          },
          nullable: false
        }
      ]
    }
  })

  t.expectUncaughtException(() => stringify('must-be-failed'))
})
