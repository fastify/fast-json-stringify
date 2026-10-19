'use strict'

const assert = require('node:assert/strict')
const { parseArgs } = require('node:util')
const { isMainThread, parentPort, workerData } = require('node:worker_threads')
const { Bench } = require('tinybench')
const build = require('..')
const { arrayKinds, arraySizes, mechanisms, arrayFixture } = require('./bench-fixtures')
const { positiveNumber, runWorker, saveResults } = require('./bench-utils')

async function measure ({ kind, size, mechanism, time, iterations }) {
  const { schema, input, typed } = arrayFixture(kind, size)
  const stringify = mechanism === 'native' ? JSON.stringify : build(schema, { largeArrayMechanism: mechanism })
  if (typed && mechanism !== 'native') {
    // Rejection is existing behavior; do not time exceptions as serialization.
    assert.throws(() => stringify(input), TypeError)
    return { kind, size, mechanism, status: 'unsupported (TypeError)' }
  }
  assert.equal(stringify(input), JSON.stringify(input))
  const bytes = Buffer.byteLength(stringify(input))
  const bench = new Bench({ time, iterations, warmupTime: 100, warmupIterations: 2, throws: true })
  bench.add(kind, () => {
    Buffer.byteLength(stringify(input))
  })
  await bench.run()
  const { latency, throughput } = bench.tasks[0].result
  return {
    kind,
    size,
    mechanism,
    status: 'ok',
    bytes,
    ops: throughput.p50,
    meanOps: throughput.mean,
    medianMs: latency.p50,
    rme: latency.rme,
    samples: latency.samplesCount
  }
}

async function main () {
  const { values } = parseArgs({ options: { kind: { type: 'string' }, size: { type: 'string' }, time: { type: 'string', default: '300' }, iterations: { type: 'string', default: '8' }, json: { type: 'string' } } })
  const kinds = values.kind ? [values.kind] : arrayKinds
  if (kinds.some(kind => !arrayKinds.includes(kind))) throw new Error(`kind must be one of ${arrayKinds.join(', ')}`)
  const sizes = values.size ? [positiveNumber(values.size, 'size', true)] : arraySizes
  const config = { time: positiveNumber(values.time, 'time'), iterations: positiveNumber(values.iterations, 'iterations', true) }
  const rows = []
  console.log('| Kind | Size | Mechanism | Median ops/sec | Latency RME % | Samples |')
  console.log('| --- | ---: | --- | ---: | ---: | ---: |')
  for (const size of sizes) {
    for (const kind of kinds) {
      for (const mechanism of mechanisms) {
        const row = await runWorker(__filename, { kind, size, mechanism, ...config })
        rows.push(row)
        console.log(`| ${kind} | ${size} | ${mechanism} | ${row.ops?.toFixed(2) ?? row.status} | ${row.rme?.toFixed(2) ?? '—'} | ${row.samples ?? '—'} |`)
      }
    }
  }
  console.log('\nTyped arrays are rejected by FJS; native serializes indexed objects. Each measured call includes Buffer.byteLength().')
  saveResults(values.json, { ...config, kinds, sizes }, rows)
}

if (isMainThread) main().catch(err => { console.error(err); process.exitCode = 1 })
else measure(workerData).then(result => parentPort.postMessage(result)).catch(err => { throw err })
