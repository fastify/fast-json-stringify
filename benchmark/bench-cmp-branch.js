'use strict'

// Measures the working tree against another revision, with the noise of this machine beside it.
//
// Each benchmark runs in four workers at once, two on the other revision (A) and two on the working
// tree (B), and they take turns in batches of about 10ms, so a machine that warms up or throttles
// slows all four together. A against A and B against B is the same code against itself: how far it
// moves is the noise. A/B is followed by the band that noise gives to it, and a row is a result only
// when A/B is outside that band.
//
//   npm run bench:cmp                                     main against the working tree
//   npm run bench:cmp -- --against v7.0.0
//   npm run bench:cmp -- --only "short string" --sessions 10
//
// On a clean tree, --against HEAD puts the same code on both sides and every row should be noise.

const { Worker, isMainThread, workerData, parentPort } = require('node:worker_threads')
const { execFileSync } = require('node:child_process')
const { once } = require('node:events')
const { parseArgs } = require('node:util')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
// inside the repo, so the other revision resolves node_modules from here
const WORKTREE = path.join(ROOT, '.bench-worktree')
const WARMUP_MS = 250
const BATCH_NS = 1e7
// how many standard errors A/B has to be from zero: with 5 sessions, about 1 row in 400 of the
// same code against itself
const BAND = 4

// the four workers are a1 a2 b1 b2; turning through these orders keeps a drift of the machine out
// of A/B in every round, and out of A/A and B/B every four rounds
const ORDERS = [[0, 2, 3, 1], [2, 0, 1, 3], [1, 3, 2, 0], [3, 1, 0, 2]]

const greenColor = '\x1b[32m'
const redColor = '\x1b[31m'
const resetColor = '\x1b[0m'

if (isMainThread) {
  main().catch((error) => {
    console.error(error)
    removeWorktree()
    process.exitCode = 1
  })
} else {
  arm()
}

// One side: builds the serializer of a benchmark, then warms it up or runs a batch when asked
function arm () {
  const build = require(workerData.lib)
  const { schema, options, input, compile } = require('./bench.js')[workerData.index]
  const stringify = compile ? null : build(schema, options)
  // read at exit, so the calls are not optimized away
  let sink = 0

  function batch (calls) {
    const start = process.hrtime.bigint()
    if (compile) {
      for (let i = 0; i < calls; i++) sink += build(schema, options)(input).length
    } else {
      for (let i = 0; i < calls; i++) sink += stringify(input).length
    }
    return Number(process.hrtime.bigint() - start)
  }

  // answers how many calls fill a batch
  function warmup (ms) {
    let calls = 1
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (batch(calls) < BATCH_NS) calls *= 2
    }
    return Math.max(1, Math.round(calls * BATCH_NS / batch(calls)))
  }

  parentPort.on('message', ({ ms, calls }) => {
    parentPort.postMessage(ms ? warmup(ms) : Math.log(calls * 1e9 / batch(calls)))
  })
  process.on('exit', () => sink)
}

function median (values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[sorted.length >> 1]
}

async function ask (worker, message) {
  const answer = once(worker, 'message')
  worker.postMessage(message)
  return (await answer)[0]
}

// Four fresh workers taking turns batch by batch. Answers, in logs and as medians over the rounds,
// B against A, A2 against A1 and B2 against B1
async function session (libs, index, rounds, number) {
  // started and warmed up one at a time, as A B B A or B A A B, so no side is always first:
  // warming up four together spread them further apart
  const start = ORDERS[number % 2]
  const workers = []
  for (const i of start) workers[i] = new Worker(__filename, { workerData: { lib: libs[i], index } })
  try {
    const calls = []
    for (const i of start) calls[i] = await ask(workers[i], { ms: WARMUP_MS })

    const ab = []
    const aa = []
    const bb = []
    for (let round = 0; round < rounds; round++) {
      const rate = []
      for (const i of ORDERS[round % ORDERS.length]) rate[i] = await ask(workers[i], { calls: calls[i] })
      const [a1, a2, b1, b2] = rate
      ab.push((b1 + b2 - a1 - a2) / 2)
      aa.push(a2 - a1)
      bb.push(b2 - b1)
    }
    return { ab: median(ab), aa: median(aa), bb: median(bb) }
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()))
  }
}

// A/B is the mean over the sessions, and its band comes from A/A and B/B: under the same code the
// four workers are alike, so A/B spreads as much as A/A and B/B together, halved
async function compare (libs, index, sessions, rounds) {
  const results = []
  for (let i = 0; i < sessions; i++) results.push(await session(libs, index, rounds, i))

  const spread = (key) => Math.sqrt(results.reduce((sum, result) => sum + result[key] ** 2, 0) / sessions)
  const aa = spread('aa')
  const bb = spread('bb')
  const ab = results.reduce((sum, result) => sum + result.ab, 0) / sessions
  const band = BAND * Math.sqrt((aa ** 2 + bb ** 2) / 4 / sessions)
  const verdict = Math.abs(ab) <= band ? 'noise' : ab > 0 ? 'faster' : 'slower'
  return { aa, bb, ab, band, verdict }
}

function git (...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function removeWorktree () {
  if (fs.existsSync(WORKTREE)) {
    try {
      git('worktree', 'remove', '--force', WORKTREE)
    } catch {
      fs.rmSync(WORKTREE, { recursive: true, force: true })
    }
  }
  git('worktree', 'prune')
}

// a log of a ratio, as a percentage
const percent = (log) => (Math.expm1(log) * 100).toFixed(1) + '%'

async function main () {
  const { values } = parseArgs({
    options: {
      against: { type: 'string', default: 'main' },
      only: { type: 'string' },
      sessions: { type: 'string', default: '5' },
      rounds: { type: 'string', default: '20' }
    }
  })
  const sessions = Number(values.sessions)
  const rounds = Number(values.rounds)

  const benchmarks = require('./bench.js')
  const selected = benchmarks
    .map((benchmark, index) => ({ name: benchmark.name, index }))
    .filter(({ name }) => !values.only || name.includes(values.only))
  const width = Math.max(...selected.map(({ name }) => name.length)) + 3

  removeWorktree()
  git('worktree', 'add', '--detach', WORKTREE, values.against)
  const libs = [WORKTREE, WORKTREE, ROOT, ROOT]

  console.log(`${values.against} (A) against the working tree (B), ${sessions} sessions of ${rounds} rounds\n`)
  const counts = { faster: 0, slower: 0, noise: 0, failed: 0 }
  try {
    for (const { name, index } of selected) {
      const label = name.padEnd(width, '.')
      try {
        const { aa, bb, ab, band, verdict } = await compare(libs, index, sessions, rounds)
        counts[verdict]++
        const sign = ab > 0 ? '+' : ''
        const line = `${label} A/A ±${percent(aa)}  B/B ±${percent(bb)}  A/B ${sign}${percent(ab)} ±${percent(band)}  ${verdict}`
        const color = verdict === 'faster' ? greenColor : verdict === 'slower' ? redColor : ''
        console.log(color ? `${color}${line}${resetColor}` : line)
      } catch (error) {
        counts.failed++
        console.log(`${label} failed: ${error.message}`)
      }
    }
  } finally {
    removeWorktree()
  }

  console.log(`\n${counts.faster} faster, ${counts.slower} slower, ${counts.noise} within the noise` +
    (counts.failed ? `, ${counts.failed} failed` : ''))
}
