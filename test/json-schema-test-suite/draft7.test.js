'use strict'

const test = require('tap').test
const { counTests, runTests } = require('./util')

const requiredTestSuite = require('./draft7/required.json')

test('required', (t) => {
  const skippedTests = ['ignores arrays', 'ignores strings', 'ignores other non-objects']
  t.plan(counTests(requiredTestSuite, skippedTests))
  runTests(t, requiredTestSuite, skippedTests)
})
