'use strict'

const { Worker } = require('node:worker_threads')
const { writeFileSync } = require('node:fs')
const os = require('node:os')

function positiveNumber (value, name, integer = false) {
  const result = Number(value)
  if (!Number.isFinite(result) || result <= 0 || (integer && !Number.isInteger(result))) {
    throw new Error(`${name} must be a positive ${integer ? 'integer' : 'number'}`)
  }
  return result
}

function runWorker (file, workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(file, { workerData })
    let result
    worker.on('message', value => { result = value })
    worker.on('error', reject)
    worker.on('exit', code => {
      if (code !== 0 || result === undefined) reject(new Error(`Benchmark worker exited ${code} without a valid result`))
      else resolve(result)
    })
  })
}

function saveResults (file, config, rows) {
  if (!file) return
  writeFileSync(file, JSON.stringify({
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    cpu: os.cpus()[0].model,
    cpus: os.cpus().length,
    config,
    rows
  }, null, 2) + '\n')
}

module.exports = { positiveNumber, runWorker, saveResults }
