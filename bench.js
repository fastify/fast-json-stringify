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

const schemaAJVJTD = {
  properties: {
    firstName: {
      type: 'string'
    },
    lastName: {
      type: 'string',
      nullable: true
    },
    age: {
      type: 'uint8'
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

const arraySchemaAJVJTD = {
  elements: schemaAJVJTD
}

const dateFormatSchema = {
  description: 'Date of birth',
  type: 'string',
  format: 'date'
}

const dateFormatSchemaCJS = {
  description: 'Date of birth',
  type: 'string',
  format: 'date'
}

const obj = {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32
}

const date = new Date()

const multiArray = []

const CJS = require('compile-json-stringify')
const CJSStringify = CJS(schemaCJS)
const CJSStringifyArray = CJS(arraySchemaCJS)
const CJSStringifyDate = CJS(dateFormatSchemaCJS)
const CJSStringifyString = CJS({ type: 'string' })

const FJS = require('.')
const stringify = FJS(schema)
const stringifyArray = FJS(arraySchema)
const stringifyDate = FJS(dateFormatSchema)
const stringifyString = FJS({ type: 'string' })
let str = ''

const Ajv = require('ajv/dist/jtd')
const ajv = new Ajv()
const ajvSerialize = ajv.compileSerializer(schemaAJVJTD)
const ajvSerializeArray = ajv.compileSerializer(arraySchemaAJVJTD)
const ajvSerializeString = ajv.compileSerializer({ type: 'string' })

// eslint-disable-next-line
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
suite.add('CJS creation', function () {
  CJS(schemaCJS)
})
suite.add('AJV Serialize creation', function () {
  ajv.compileSerializer(schemaAJVJTD)
})

suite.add('JSON.stringify array', function () {
  JSON.stringify(multiArray)
})

suite.add('fast-json-stringify array', function () {
  stringifyArray(multiArray)
})

suite.add('compile-json-stringify array', function () {
  CJSStringifyArray(multiArray)
})

suite.add('AJV Serialize array', function () {
  ajvSerializeArray(multiArray)
})

suite.add('JSON.stringify long string', function () {
  JSON.stringify(str)
})

suite.add('fast-json-stringify long string', function () {
  stringifyString(str)
})

suite.add('compile-json-stringify long string', function () {
  CJSStringifyString(str)
})

suite.add('AJV Serialize long string', function () {
  ajvSerializeString(str)
})

suite.add('JSON.stringify short string', function () {
  JSON.stringify('hello world')
})

suite.add('fast-json-stringify short string', function () {
  stringifyString('hello world')
})

suite.add('compile-json-stringify short string', function () {
  CJSStringifyString('hello world')
})

suite.add('AJV Serialize short string', function () {
  ajvSerializeString('hello world')
})

suite.add('JSON.stringify obj', function () {
  JSON.stringify(obj)
})

suite.add('fast-json-stringify obj', function () {
  stringify(obj)
})

suite.add('compile-json-stringify obj', function () {
  CJSStringify(obj)
})

suite.add('AJV Serialize obj', function () {
  ajvSerialize(obj)
})

suite.add('JSON stringify date', function () {
  JSON.stringify(date)
})

suite.add('fast-json-stringify date format', function () {
  stringifyDate(date)
})

suite.add('compile-json-stringify date format', function () {
  CJSStringifyDate(date)
})

suite.on('cycle', cycle)

suite.run()

function cycle (e) {
  console.log(e.target.toString())
}
