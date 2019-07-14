'use strict'

const build = require('../..')

function runTests (t, testsuite, skippedTests) {
  for (const scenario of testsuite) {
    const stringify = build(scenario.schema)
    for (const test of scenario.tests) {
      if (skippedTests.indexOf(test.description) !== -1) {
        t.comment('skip %s', test.description)
        continue
      }
      t.test(test.description, (t) => {
        t.plan(1)
        try {
          const output = stringify(test.data)
          t.equal(output, JSON.stringify(test.data), 'compare payloads')
        } catch (err) {
          if (test.valid === false) {
            t.pass('payload is invalid')
          } else {
            t.fail('payload should be valid: ' + err.message)
          }
        }
      })
    }
  }
}

function counTests (ts, skippedTests) {
  return ts.reduce((a, b) => a + b.tests.length, 0) - skippedTests.length
}

module.exports = { runTests, counTests }
