'use strict'

const test = require('tap').test
const build = require('.')

const example = {
	"title": "Example Schema",
	"type": "object",
	"properties": {
		"firstName": {
			"type": "string"
		},
		"lastName": {
			"type": "string"
		},
		"age": {
			"description": "Age in years",
			"type": "integer",
			"minimum": 0
		}
	},
	"required": ["firstName", "lastName"]
}

test('render a basic json', (t) => {
  t.plan(2)

  const stringify = build(example)
  const obj = {
    firstName: 'Matteo',
    lastName: 'Collina',
    age: 32
  }

  const output = stringify(obj)

  t.deepEqual(JSON.parse(output), obj)
  t.equal(output, JSON.stringify(obj))
})
