'use strict'

// The compiled serializer against JSON.stringify: a random schema, a value that conforms to
// it, and the text the serializer writes must be, byte for byte, JSON.stringify of what the
// README says that value serializes to. Three arms write it: the function compiled in memory,
// the standalone code written to a file and required back, and the large array mechanism
// that hands arrays over to JSON.stringify.
//
//   node fuzz/stringify.js                two hundred rounds
//   node fuzz/stringify.js --seed 12345   replay what a past run did
//   node fuzz/stringify.js --keep-going   do not stop at the first divergence

const fs = require('node:fs')
const path = require('node:path')
const fjs = require('..')
const { main } = require('./lib')
const { draw, expected, render, variants, source } = require('./schema')

// inside the repo, since the standalone code requires fast-json-stringify by name
const tmp = path.join(__dirname, 'standalone')
fs.mkdirSync(tmp, { recursive: true })
let files = 0

// what an arm answered: the text, or the error it threw
const attempt = (fn) => {
  try {
    return fn()
  } catch (error) {
    return `threw ${error.message}`
  }
}

// each arm serializes the value, and says from how many items it hands an array to JSON.stringify
const LARGE = 3
const ARMS = {
  compiled: (schema, value) => attempt(() => fjs(schema)(value)),
  standalone: (schema, value) => attempt(() => {
    const file = path.join(tmp, `s${files++}.js`)
    fs.writeFileSync(file, fjs(schema, { mode: 'standalone' }))
    try {
      return require(file)(value)
    } finally {
      fs.rmSync(file)
    }
  }),
  largeArray: (schema, value) => attempt(() => fjs(schema, { largeArrayMechanism: 'json-stringify', largeArraySize: LARGE })(value))
}
const LARGE_ARRAYS = { largeArray: LARGE }

async function run (plan) {
  for (const [arm, serialize] of Object.entries(ARMS)) {
    let want
    try {
      want = render(expected(plan.schema, plan.value, plan.schema, LARGE_ARRAYS[arm]))
    } catch (error) {
      return `the model has no expectation: ${error.message}`
    }
    const got = serialize(plan.schema, plan.value)
    if (got !== want) return `${arm}\n  expected: ${want}\n  got:      ${got}`
  }
  return null
}

main({ name: 'stringify', draw, run, variants, source })
