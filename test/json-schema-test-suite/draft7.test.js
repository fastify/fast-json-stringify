'use strict'

const { describe } = require('node:test')
const { runTests } = require('./util')

const requiredTestSuite = require('./draft7/required.json')

describe('required', (t) => {
  const skippedTests = ['ignores arrays', 'ignores strings', 'ignores other non-objects']
  runTests(t, requiredTestSuite, skippedTests)
})
