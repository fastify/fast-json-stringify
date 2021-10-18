'use strict'

const test = require('tap').test
const build = require('..')

test('can stringify recursive directory tree (issue #181)', (t) => {
  t.plan(1)

  const schema = {
    definitions: {
      directory: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          subDirectories: {
            type: 'array',
            items: { $ref: '#/definitions/directory' },
            default: []
          }
        }
      }
    },
    type: 'array',
    items: { $ref: '#/definitions/directory' }
  }
  const stringify = build(schema)

  t.equal(stringify([
    { name: 'directory 1', subDirectories: [] },
    {
      name: 'directory 2',
      subDirectories: [
        { name: 'directory 2.1', subDirectories: [] },
        { name: 'directory 2.2', subDirectories: [] }
      ]
    }
  ]), '[{"name":"directory 1","subDirectories":[]},{"name":"directory 2","subDirectories":[{"name":"directory 2.1","subDirectories":[]},{"name":"directory 2.2","subDirectories":[]}]}]')
})
