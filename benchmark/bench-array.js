'use strict'

const path = require('path')
const { Worker } = require('worker_threads')

const BENCH_THREAD_PATH = path.join(__dirname, 'bench-thread.js')

const benchmarks = [
  {
    name: 'empty array',
    schema: {
      type: 'array',
      items: { type: 'number' }
    },
    input: []
  },
  {
    name: 'array with one number value',
    schema: {
      type: 'array',
      items: { type: 'number' }
    },
    input: [1]
  },
  {
    name: 'array with two number values',
    schema: {
      type: 'array',
      items: { type: 'number' }
    },
    input: [1, 2]
  },
  {
    name: 'array with three number values',
    schema: {
      type: 'array',
      items: { type: 'number' }
    },
    input: [1, 2, 3]
  },
  {
    name: 'array with three four values',
    schema: {
      type: 'array',
      items: { type: 'number' }
    },
    input: [1, 2, 3, 4]
  }
]

async function runBenchmark (benchmark) {
  const worker = new Worker(BENCH_THREAD_PATH, { workerData: benchmark })

  return new Promise((resolve, reject) => {
    let result = null
    worker.on('error', reject)
    worker.on('message', (benchResult) => {
      result = benchResult
    })
    worker.on('exit', (code) => {
      if (code === 0) {
        resolve(result)
      } else {
        reject(new Error(`Worker stopped with exit code ${code}`))
      }
    })
  })
}

async function runBenchmarks () {
  let maxNameLength = 0
  for (const benchmark of benchmarks) {
    maxNameLength = Math.max(benchmark.name.length, maxNameLength)
  }

  for (const benchmark of benchmarks) {
    benchmark.name = benchmark.name.padEnd(maxNameLength, '.')
    const resultMessage = await runBenchmark(benchmark)
    console.log(resultMessage)
  }
}

runBenchmarks()
