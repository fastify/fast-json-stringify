'use strict'

const { it } = require('node:test')
const { equal, ok } = require('node:assert')
const build = require('../..')

function runTests (t, testsuite, skippedTests) {
  for (const scenario of testsuite) {
    const stringify = build(scenario.schema)
    for (const test of scenario.tests) {
      if (skippedTests.indexOf(test.description) !== -1) {
        console.log(`skip ${test.description}`)
        continue
      }
      it(test.description, (t) => {
        try {
          const output = stringify(test.data)
          equal(output, JSON.stringify(test.data), 'compare payloads')
        } catch (err) {
          ok(test.valid === false)
        }
      })
    }
  }
}

function counTests (ts, skippedTests) {
  return ts.reduce((a, b) => a + b.tests.length, 0) - skippedTests.length
}

module.exports = { runTests, counTests }
