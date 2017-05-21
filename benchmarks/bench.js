'use strict'

const benchmark = require('benchmark')
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

const arraySchema = {
  title: 'array schema',
  type: 'array',
  items: schema
}

const obj = {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32
}

const multiArray = []

const stringify = require('.')(schema)
const stringifyArray = require('.')(arraySchema)
const stringifyString = require('.')({ type: 'string' })
var str = ''

for (var i = 0; i < 10000; i++) {
  str += i
  if (i % 100 === 0) {
    str += '"'
  }
}

Number(str)

for (i = 0; i < 1000; i++) {
  multiArray.push(obj)
}

suite.add('JSON.stringify array', function () {
  JSON.stringify(multiArray)
})

suite.add('fast-json-stringify array', function () {
  stringifyArray(multiArray)
})

suite.add('JSON.stringify long string', function () {
  JSON.stringify(str)
})

suite.add('fast-json-stringify long string', function () {
  stringifyString(str)
})

suite.add('JSON.stringify short string', function () {
  JSON.stringify('hello world')
})

suite.add('fast-json-stringify short string', function () {
  stringifyString('hello world')
})

suite.add('JSON.stringify obj', function () {
  JSON.stringify(obj)
})

suite.add('fast-json-stringify obj', function () {
  stringify(obj)
})

suite.on('cycle', cycle)

suite.run()

function cycle (e) {
  console.log(e.target.toString())
}
