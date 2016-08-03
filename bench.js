'use strict'

const benchmark = require('benchmark')
const safeStringify = require('fast-safe-stringify')
const suite = new benchmark.Suite()

const schema = {
  'title': 'Example Schema',
  'type': 'object',
  'properties': {
    'firstName': {
      'type': 'string'
    },
    'lastName': {
      'type': 'string'
    },
    'age': {
      'description': 'Age in years',
      'type': 'integer',
      'minimum': 0
    }
  }
}

const obj = {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32
}

const stringify = require('.')(schema)

suite.add('JSON.stringify', function () {
  JSON.stringify(obj)
})

suite.add('fast-json-stringify', function () {
  stringify(obj)
})

suite.add('fast-safe-stringify', function () {
  safeStringify(obj)
})

suite.on('complete', print)

suite.run()

function print () {
  for (var i = 0; i < this.length; i++) {
    console.log(this[i].toString())
  }

  console.log('Fastest is', this.filter('fastest').map('name')[0])
}
