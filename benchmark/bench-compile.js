'use strict'

const assert = require('node:assert/strict')
const { parseArgs } = require('node:util')
const { isMainThread, parentPort, workerData } = require('node:worker_threads')
const { Bench } = require('tinybench')
const build = require('..')
const { compileFixtures } = require('./bench-fixtures')
const { positiveNumber, runWorker, saveResults } = require('./bench-utils')

async function measure ({ name, iterations }) {
  const { schema, options } = compileFixtures()[name]
  let output
  const bench = new Bench({ time: 0, iterations, warmupTime: 0, warmupIterations: 20, throws: true })
  bench.add(name, () => { output = build(schema, options) })
  await bench.run()
  assert.equal(typeof output, options?.mode === 'standalone' ? 'string' : 'function')
  const { latency } = bench.tasks[0].result
  return { name, medianMs: latency.p50, meanMs: latency.mean, sdMs: latency.sd, rme: latency.rme, ops: 1000 / latency.p50, samples: latency.samplesCount }
}

async function main () {
  const { values } = parseArgs({ options: { case: { type: 'string' }, iterations: { type: 'string', default: '100' }, json: { type: 'string' } } })
  const names = values.case ? [values.case] : Object.keys(compileFixtures())
  if (names.some(name => !Object.hasOwn(compileFixtures(), name))) throw new Error('Unknown compile case')
  const config = { iterations: positiveNumber(values.iterations, 'iterations', true), warmupIterations: 20 }
  const rows = []
  console.log('| Schema | Median build ms | Median builds/sec | SD ms | RME % | Samples |')
  console.log('| --- | ---: | ---: | ---: | ---: | ---: |')
  for (const name of names) {
    const row = await runWorker(__filename, { name, ...config })
    rows.push(row)
    console.log(`| ${name} | ${row.medianMs.toFixed(4)} | ${row.ops.toFixed(2)} | ${row.sdMs.toFixed(4)} | ${row.rme.toFixed(2)} | ${row.samples} |`)
  }
  console.log('\nSchema allocation, module loading and 20 warmup builds are excluded; standalone measures source generation, not loading the generated module.')
  saveResults(values.json, { ...config, names }, rows)
}

if (isMainThread) main().catch(err => { console.error(err); process.exitCode = 1 })
else measure(workerData).then(result => parentPort.postMessage(result)).catch(err => { throw err })
