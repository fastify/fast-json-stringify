'use strict'

const benchmark = require('benchmark')

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

const fastStringify = require('../')
const stringify = fastStringify(schema)
const stringifyArray = fastStringify(arraySchema)
const stringifyString = fastStringify({ type: 'string' })

var varLongStringConcatViaForLoopRaw = concat('"', 10000)
var varLongStringConcatViaForLoopNumbered = concat('"', 10000)
var varLongStringConcatViaArrayJoinRaw = tacnoc('"', 10000)
var varLongStringConcatViaArrayJoinNumbered = tacnoc('"', 10000)

Number(varLongStringConcatViaForLoopNumbered)
Number(varLongStringConcatViaArrayJoinNumbered)

const constLongStringConcatViaForLoopRaw = concat('"', 10000)
const constLongStringConcatViaForLoopNumbered = concat('"', 10000)
const constLongStringConcatViaArrayJoinRaw = tacnoc('"', 10000)
const constLongStringConcatViaArrayJoinNumbered = tacnoc('"', 10000)

Number(constLongStringConcatViaForLoopNumbered)
Number(constLongStringConcatViaArrayJoinNumbered)

const ARRAY_SIZE = 1000
const multiArray = new Array(ARRAY_SIZE)

for (let i = ARRAY_SIZE; i--;) {
  multiArray[i] = obj
}

var shortString = 'hello world'
let letShortString = 'hello world'
const constShortString = 'hello world'

console.log('\nArray:')
new benchmark.Suite()
  .add('Array        JSON.stringify      ', () => JSON.stringify(multiArray))
  .add('Array        fast-json-stringify ', () => stringifyArray(multiArray)).on('cycle', cycle).run()

console.log('\n=> varLongStringConcatViaForLoopRaw:'.replace(/_/g, ' '))
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(varLongStringConcatViaForLoopRaw))
  .add('String Long  fast-json-stringify ', () => stringifyString(varLongStringConcatViaForLoopRaw)).on('cycle', cycle).run()

console.log('\n=> varLongStringConcatViaForLoopNumbered:'.replace(/_/g, ' '))
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(varLongStringConcatViaForLoopNumbered))
  .add('String Long  fast-json-stringify ', () => stringifyString(varLongStringConcatViaForLoopNumbered)).on('cycle', cycle).run()

console.log('\n=> varLongStringConcatViaArrayJoinRaw:'.replace(/_/g, ' '))
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(varLongStringConcatViaArrayJoinRaw))
  .add('String Long  fast-json-stringify ', () => stringifyString(varLongStringConcatViaArrayJoinRaw)).on('cycle', cycle).run()

console.log('\n=> varLongStringConcatViaArrayJoinNumbered:'.replace(/_/g, ' '))
new benchmark.Suite()
  .add('String Long  JSON.stringify      ', () => JSON.stringify(varLongStringConcatViaArrayJoinNumbered))
  .add('String Long  fast-json-stringify ', () => stringifyString(varLongStringConcatViaArrayJoinNumbered)).on('cycle', cycle).run()

console.log('\n=> constLongStringConcatViaForLoopRaw:')
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(constLongStringConcatViaForLoopRaw))
  .add('String Long C fast-json-stringify', () => stringifyString(constLongStringConcatViaForLoopRaw)).on('cycle', cycle).run()

console.log('\n=> constLongStringConcatViaForLoopNumbered:')
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(constLongStringConcatViaForLoopNumbered))
  .add('String Long C fast-json-stringify', () => stringifyString(constLongStringConcatViaForLoopNumbered)).on('cycle', cycle).run()

console.log('\n=> constLongStringConcatViaArrayJoinRaw:')
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(constLongStringConcatViaArrayJoinRaw))
  .add('String Long C fast-json-stringify', () => stringifyString(constLongStringConcatViaArrayJoinRaw)).on('cycle', cycle).run()

console.log('\n=> constLongStringConcatViaArrayJoinNumbered:')
new benchmark.Suite()
  .add('String Long C JSON.stringify     ', () => JSON.stringify(constLongStringConcatViaArrayJoinNumbered))
  .add('String Long C fast-json-stringify', () => stringifyString(constLongStringConcatViaArrayJoinNumbered)).on('cycle', cycle).run()

console.log('\nString short:')
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify('hello world'))
  .add('String Short fast-json-stringify ', () => stringifyString('hello world')).on('cycle', cycle).run()

console.log('\nString short LET:')
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify(letShortString))
  .add('String Short fast-json-stringify ', () => stringifyString(letShortString)).on('cycle', cycle).run()

console.log('\nString short Var:')
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify(shortString))
  .add('String Short fast-json-stringify ', () => stringifyString(shortString)).on('cycle', cycle).run()

console.log('\nString short Const:')
new benchmark.Suite()
  .add('String Short JSON.stringify      ', () => JSON.stringify(constShortString))
  .add('String Short fast-json-stringify ', () => stringifyString(constShortString)).on('cycle', cycle).run()

console.log('\nObject:')
new benchmark.Suite()
  .add('Object       JSON.stringify      ', () => JSON.stringify(obj))
  .add('Object       fast-json-stringify ', () => stringify(obj)).on('cycle', cycle).run()

function cycle (e) {
  console.log(e.target.toString())
}

function concat (str, times) {
  var tempString = ''

  for (let i = 0; i < times; i++) {
    tempString += i
    if (i % 100 === 0) { tempString += str }
  }

  return tempString
}

function tacnoc (str, times) {
  return new Array(times).join(str)
}
