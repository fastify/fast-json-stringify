'use strict'

const { workerData: benchmark, parentPort } = require('worker_threads')

const Ajv = require('ajv')
const ajvFormats = require('ajv-formats')
const fastUri = require('fast-uri')

const FJS = require('..')

const Benchmark = require('benchmark')
Benchmark.options.minSamples = 500

const suite = Benchmark.Suite()

const ajv = new Ajv({
  strictSchema: false,
  validateSchema: false,
  allowUnionTypes: true,
  uriResolver: fastUri
})

ajvFormats(ajv)

const validate = ajv.compile(benchmark.schema)
const stringify = FJS(benchmark.schema)

suite
  .add(benchmark.name, () => {
    validate(benchmark.input)
    stringify(benchmark.input)
  })
  .on('cycle', (event) => {
    parentPort.postMessage(String(event.target))
  })
  .on('complete', () => {})
  .run()
