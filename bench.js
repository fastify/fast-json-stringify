'use strict'

const benchmark = require('benchmark')
const suite = new benchmark.Suite()

const schema = {
  title: 'Example Schema',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    },
    lastName: {
      type: ['string', 'null']
    },
    age: {
      description: 'Age in years',
      type: 'integer',
      minimum: 0
    }
  }
}
const schemaCJS = {
  title: 'Example Schema',
  type: 'object',
  properties: {
    firstName: {
      type: 'string'
    },
    lastName: {
      type: ['string', 'null']
    },
    age: {
      description: 'Age in years',
      type: 'number',
      minimum: 0
    }
  }
}

const arraySchema = {
  title: 'array schema',
  type: 'array',
  items: schema
}

const arraySchemaCJS = {
  title: 'array schema',
  type: 'array',
  items: schemaCJS
}

const obj = {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32
}

const multiArray = []

const JSTR = require('json-strify')
const JSTRStringify = JSTR(schemaCJS)
const JSTRArray = JSTR(arraySchemaCJS)
const JSTRInstance = JSTR()

const CJS = require('compile-json-stringify')
const CJSStringify = CJS(schemaCJS)
const CJSStringifyArray = CJS(arraySchemaCJS)
const CJSStringifyString = CJS({ type: 'string' })

const FJS = require('.')
const stringify = FJS(schema)
const stringifyArray = FJS(arraySchema)
const stringifyString = FJS({ type: 'string' })
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

suite.add('FJS creation', function () {
  FJS(schema)
})
suite.add('JSTR creation', function () {
  JSTR(schemaCJS)
})
suite.add('CJS creation', function () {
  CJS(schemaCJS)
})

suite.add('JSON.stringify array', function () {
  JSON.stringify(multiArray)
})

suite.add('fast-json-stringify array', function () {
  stringifyArray(multiArray)
})

suite.add('json-strify array', function () {
  JSTRArray(multiArray)
})

suite.add('compile-json-stringify array', function () {
  CJSStringifyArray(multiArray)
})

suite.add('JSON.stringify long string', function () {
  JSON.stringify(str)
})

suite.add('fast-json-stringify long string', function () {
  stringifyString(str)
})

suite.add('json-strify long string', function () {
  JSTRInstance(str)
})

suite.add('compile-json-stringify long string', function () {
  CJSStringifyString(str)
})

suite.add('JSON.stringify short string', function () {
  JSON.stringify('hello world')
})

suite.add('fast-json-stringify short string', function () {
  stringifyString('hello world')
})

suite.add('json-strify short string', function () {
  JSTRInstance('hello world')
})

suite.add('compile-json-stringify short string', function () {
  CJSStringifyString('hello world')
})

suite.add('JSON.stringify obj', function () {
  JSON.stringify(obj)
})

suite.add('fast-json-stringify obj', function () {
  stringify(obj)
})

suite.add('json-strify obj', function () {
  JSTRStringify(obj)
})

suite.add('compile-json-stringify obj', function () {
  CJSStringify(obj)
})

suite.on('cycle', cycle)

suite.run()

function cycle (e) {
  console.log(e.target.toString())
}
