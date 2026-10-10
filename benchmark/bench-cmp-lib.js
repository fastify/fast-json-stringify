'use strict'

const assert = require('node:assert/strict')
const { Bench } = require('tinybench')
const apiResponses = require('./fixtures/api-responses')
const suite = new Bench({
  name: 'Library Comparison Benchmarks',
  setup: (_task, mode) => {
    // Run the garbage collector before warmup at each cycle
    if (mode === 'warmup' && typeof globalThis.gc === 'function') {
      globalThis.gc()
    }
  }
})

const STR_LEN = 1e4
const LARGE_ARRAY_SIZE = 2e4
const MULTI_ARRAY_LENGTH = 1e3

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
  format: 'datetime'
}

const dateFormatSchemaCJS = {
  description: 'Date of birth',
  type: 'string',
  format: 'datetime'
}

const obj = {
  firstName: 'Matteo',
  lastName: 'Collina',
  age: 32
}

const date = new Date()

const multiArray = new Array(MULTI_ARRAY_LENGTH)
const largeArray = new Array(LARGE_ARRAY_SIZE)

const CJS = require('compile-json-stringify')
const CJSStringify = CJS(schemaCJS)
const CJSStringifyArray = CJS(arraySchemaCJS)
const CJSStringifyDate = CJS(dateFormatSchemaCJS)
const CJSStringifyString = CJS({ type: 'string' })

const FJS = require('..')
const stringify = FJS(schema)
const stringifyArrayDefault = FJS(arraySchema)
const stringifyArrayJSONStringify = FJS(arraySchema, {
  largeArrayMechanism: 'json-stringify'
})
const stringifyDate = FJS(dateFormatSchema)
const stringifyString = FJS({ type: 'string' })
let str = ''

const Ajv = require('ajv/dist/jtd')
const ajv = new Ajv()
const ajvSerialize = ajv.compileSerializer(schemaAJVJTD)
const ajvSerializeArray = ajv.compileSerializer(arraySchemaAJVJTD)
const ajvSerializeString = ajv.compileSerializer({ type: 'string' })

const { createAccelerator } = require('json-accelerator')
const accelStringify = createAccelerator(schema)
const accelArray = createAccelerator(arraySchema)
const accelDate = FJS(dateFormatSchema)
const accelString = FJS({ type: 'string' })

const getRandomString = (length) => {
  if (!Number.isInteger(length)) {
    throw new Error('Expected integer length')
  }

  const validCharacters = 'abcdefghijklmnopqrstuvwxyz'
  const nValidCharacters = 26

  let result = ''
  for (let i = 0; i < length; ++i) {
    result += validCharacters[Math.floor(Math.random() * nValidCharacters)]
  }

  return result[0].toUpperCase() + result.slice(1)
}

for (let i = 0; i < STR_LEN; i++) {
  largeArray[i] = {
    firstName: getRandomString(8),
    lastName: getRandomString(6),
    age: Math.ceil(Math.random() * 99)
  }

  str += i
  if (i % 100 === 0) {
    str += '"'
  }
}

for (let i = STR_LEN; i < LARGE_ARRAY_SIZE; ++i) {
  largeArray[i] = {
    firstName: getRandomString(10),
    lastName: getRandomString(4),
    age: Math.ceil(Math.random() * 99)
  }
}

for (let i = 0; i < MULTI_ARRAY_LENGTH; i++) {
  multiArray[i] = obj
}

// Some serializers return unflattened strings. Fastify calls Buffer.byteLength()
// for Content-Length, which triggers flattening; include that cost in every case.
suite.add('fast-json-stringify: creation and first stringify', function () {
  Buffer.byteLength(FJS(schema)(obj))
})
suite.add('compile-json-stringify: creation and first stringify', function () {
  Buffer.byteLength(CJS(schemaCJS)(obj))
})
suite.add('AJV: creation and first stringify', function () {
  Buffer.byteLength(ajv.compileSerializer(schemaAJVJTD)(obj))
})
suite.add('json-accelerator: creation and first stringify', function () {
  Buffer.byteLength(createAccelerator(schema)(obj))
})

suite.add('JSON.stringify: array', function () {
  Buffer.byteLength(JSON.stringify(multiArray))
})

suite.add('fast-json-stringify [default]: array', function () {
  Buffer.byteLength(stringifyArrayDefault(multiArray))
})

suite.add('json-accelerator: array', function () {
  Buffer.byteLength(accelArray(multiArray))
})

suite.add('fast-json-stringify [json-stringify]: array', function () {
  Buffer.byteLength(stringifyArrayJSONStringify(multiArray))
})

suite.add('compile-json-stringify: array', function () {
  Buffer.byteLength(CJSStringifyArray(multiArray))
})

suite.add('AJV: array', function () {
  Buffer.byteLength(ajvSerializeArray(multiArray))
})

suite.add('JSON.stringify: large array', function () {
  Buffer.byteLength(JSON.stringify(largeArray))
})

suite.add('fast-json-stringify [default]: large array', function () {
  Buffer.byteLength(stringifyArrayDefault(largeArray))
})

suite.add('fast-json-stringify [json-stringify]: large array', function () {
  Buffer.byteLength(stringifyArrayJSONStringify(largeArray))
})

suite.add('compile-json-stringify: large array', function () {
  Buffer.byteLength(CJSStringifyArray(largeArray))
})

suite.add('AJV: large array', function () {
  Buffer.byteLength(ajvSerializeArray(largeArray))
})

suite.add('JSON.stringify: long string', function () {
  Buffer.byteLength(JSON.stringify(str))
})

suite.add('fast-json-stringify: long string', function () {
  Buffer.byteLength(stringifyString(str))
})

suite.add('json-accelerator: long string', function () {
  Buffer.byteLength(stringifyString(str))
})

suite.add('compile-json-stringify: long string', function () {
  Buffer.byteLength(CJSStringifyString(str))
})

suite.add('AJV: long string', function () {
  Buffer.byteLength(ajvSerializeString(str))
})

suite.add('JSON.stringify: short string', function () {
  Buffer.byteLength(JSON.stringify('hello world'))
})

suite.add('fast-json-stringify: short string', function () {
  Buffer.byteLength(stringifyString('hello world'))
})

suite.add('json-accelerator: short string', function () {
  Buffer.byteLength(accelString('hello world'))
})

suite.add('compile-json-stringify: short string', function () {
  Buffer.byteLength(CJSStringifyString('hello world'))
})

suite.add('AJV: short string', function () {
  Buffer.byteLength(ajvSerializeString('hello world'))
})

suite.add('JSON.stringify: obj', function () {
  Buffer.byteLength(JSON.stringify(obj))
})

suite.add('fast-json-stringify: obj', function () {
  Buffer.byteLength(stringify(obj))
})

suite.add('json-accelerator: obj', function () {
  Buffer.byteLength(accelStringify(obj))
})

suite.add('compile-json-stringify: obj', function () {
  Buffer.byteLength(CJSStringify(obj))
})

suite.add('AJV: obj', function () {
  Buffer.byteLength(ajvSerialize(obj))
})

suite.add('JSON.stringify: date', function () {
  Buffer.byteLength(JSON.stringify(date))
})

suite.add('fast-json-stringify: date', function () {
  Buffer.byteLength(stringifyDate(date))
})

suite.add('json-accelerate: date', function () {
  Buffer.byteLength(accelDate(date))
})

suite.add('compile-json-stringify: date', function () {
  Buffer.byteLength(CJSStringifyDate(date))
})

for (const { name, schema: responseSchema, input } of apiResponses) {
  const stringifyResponse = FJS(responseSchema)
  // Check outside the timed loop that the schema preserves the complete response.
  assert.deepStrictEqual(JSON.parse(stringifyResponse(input)), JSON.parse(JSON.stringify(input)))

  suite.add(`JSON.stringify: ${name}`, function () {
    Buffer.byteLength(JSON.stringify(input))
  })
  suite.add(`fast-json-stringify: ${name}`, function () {
    Buffer.byteLength(stringifyResponse(input))
  })
}

if (process.argv.includes('--fjs-vs-json')) {
  for (const task of suite.tasks) {
    if (!task.name.startsWith('fast-json-stringify') && !task.name.startsWith('JSON.stringify:')) {
      suite.remove(task.name)
    }
  }
}

suite.run().then(() => {
  const results = suite.tasks.map(task => ({
    name: task.name,
    hz: task.result.throughput.mean,
    rme: task.result.latency.rme,
    samples: task.result.latency.df + 1
  }))

  const scenarios = {}
  for (const result of results) {
    const [library, scenario] = result.name.split(':').map(s => s.trim())

    if (!scenarios[scenario]) scenarios[scenario] = []
    scenarios[scenario].push({ ...result, library })
  }

  for (const [scenario, tasks] of Object.entries(scenarios)) {
    console.log(`\n--- ${scenario} ---`)
    const sorted = tasks.sort((a, b) => b.hz - a.hz)
    const winner = sorted[0]

    for (const task of sorted) {
      const formattedHz = task.hz.toLocaleString('en-US', { maximumFractionDigits: 0 })
      const formattedRme = task.rme.toFixed(2)
      const isWinner = task === winner
      const prefix = isWinner ? '🏆 ' : '   '

      console.log(`${prefix}${task.library.padEnd(40)} x ${formattedHz.padStart(15)} ops/sec ±${formattedRme}% (${task.samples} runs sampled)`)
    }
  }
}).catch(err => console.error(`Error: ${err.message}`))
