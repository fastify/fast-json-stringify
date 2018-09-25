'use strict'

const test = require('tap').test
const build = require('..')

function User () {
  this.groups = [{ name: 'admin' }, { name: 'subscriber' }]
  this.toJSON = function () {
    var result = []
    for (var i = 0; i < this.groups.length; i++) {
      result.push(this.groups[i].name)
    }
    return JSON.stringify({
      groups: result
    }, null, 2)
  }
}

test('should apply toJSON if exists', (t) => {
  t.plan(1)

  const stringify = build({
    type: 'object',
    properties: {
      groups: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  })

  const user = new User()

  t.equal(stringify(user), user.toJSON())
})
