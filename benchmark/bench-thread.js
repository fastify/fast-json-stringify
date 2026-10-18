'use strict'

const { workerData: benchmark, parentPort } = require('worker_threads')

const { Bench } = require('tinybench')

const bench = new Bench({
  name: benchmark.name,
  setup: (_task, mode) => {
    // Run the garbage collector before warmup at each cycle
    if (mode === 'warmup' && typeof globalThis.gc === 'function') {
      globalThis.gc()
    }
  }
})

const FJS = require('..')
const stringify = benchmark.compile ? null : FJS(benchmark.schema, benchmark.options)

bench.add(benchmark.name, () => {
  // Some serializers return unflattened strings. Fastify calls Buffer.byteLength()
  // for Content-Length, which triggers flattening; include that cost here too.
  if (benchmark.compile) {
    Buffer.byteLength(FJS(benchmark.schema, benchmark.options)(benchmark.input))
  } else {
    Buffer.byteLength(stringify(benchmark.input))
  }
}).run().then(() => {
  const task = bench.tasks[0]
  const hz = task.result.throughput.mean // ops/sec
  const rme = task.result.latency.rme // relative margin of error (%)
  const samples = task.result.latency.df + 1 // degrees of freedom + 1 = sample count

  const formattedHz = hz.toLocaleString('en-US', { maximumFractionDigits: 0 })
  const formattedRme = rme.toFixed(2)

  const output = `${task.name} x ${formattedHz} ops/sec ±${formattedRme}% (${samples} runs sampled)`
  parentPort.postMessage(output)
}).catch(err => parentPort.postMessage(`Error: ${err.message}`))
