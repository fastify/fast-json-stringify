'use strict'

const test = require('tap').test
const validator = require('../../lib/keywords/const').validator

test('string', (t) => {
  t.plan(2)

  const validateConst = validator('stringValue')

  t.equal(validateConst('stringValue'), true)
  t.equal(validateConst('b'), false)
})

test('number', (t) => {
  t.plan(2)

  const validateConst = validator(42)

  t.equal(validateConst(42), true)
  t.equal(validateConst(43), false)
})

test('bigint', (t) => {
  t.plan(2)

  const validateConst = validator(42n)

  t.equal(validateConst(42n), true)
  t.equal(validateConst(43n), false)
})

test('boolean', (t) => {
  t.plan(2)

  const validateConst = validator(true)

  t.equal(validateConst(true), true)
  t.equal(validateConst(false), false)
})

test('null', (t) => {
  t.plan(2)

  const validateConst = validator(null)

  t.equal(validateConst(null), true)
  t.equal(validateConst('null'), false)
})

test('array, basic', (t) => {
  t.plan(3)

  const validateConst = validator([1, 2, 3])

  t.equal(validateConst([1, 2, 3]), true)
  t.equal(validateConst([1, 2]), false)
  t.equal(validateConst([1, 2, 3, 4]), false)
})

test('array, only numbers', (t) => {
  t.plan(2)

  const validateConst = validator([1, 2, 3])

  t.equal(validateConst([1, 2, 3]), true)
  t.equal(validateConst([1, 2, 4]), false)
})

test('array, sub arrays with numbers', (t) => {
  t.plan(3)

  const validateConst = validator([[1, 2], 3])

  t.equal(validateConst([[1, 2], 3]), true)
  t.equal(validateConst([[1, 2], 4]), false)
  t.equal(validateConst([[1, 3], 4]), false)
})

test('object, two properties', (t) => {
  t.plan(3)

  const validateConst = validator({ a: 1, b: 2 })

  t.equal(validateConst({ a: 1, b: 2 }), true)
  t.equal(validateConst({ b: 2, a: 1 }), true)
  t.equal(validateConst({ a: 1, b: 3 }), false)
})

test('NaN', (t) => {
  t.plan(2)

  const validateConst = validator(NaN)

  t.equal(validateConst(NaN), true)
  t.equal(validateConst(Infinity), false)
})

test('Infinity', (t) => {
  t.plan(2)

  const validateConst = validator(Infinity)

  t.equal(validateConst(Infinity), true)
  t.equal(validateConst(-Infinity), false)
})

test('Infinity', (t) => {
  t.plan(2)

  const validateConst = validator(Infinity)

  t.equal(validateConst(Infinity), true)
  t.equal(validateConst(-Infinity), false)
})

test('RegExp', (t) => {
  t.plan(3)

  const validateConst = validator(/a-z/g)

  t.equal(validateConst(/a-z/g), true)
  t.equal(validateConst(/a-z/gm), false)
  t.equal(validateConst(/a-Z/gm), false)
})

test('Date', (t) => {
  t.plan(2)

  const validateConst = validator(new Date(123))

  t.equal(validateConst(new Date(123)), true)
  t.equal(validateConst(new Date(124)), false)
})

const spec = require('../spec/fast-deep-equal.spec')

spec.forEach(function (suite) {
  test(suite.description, function (t) {
    t.plan(suite.tests.length * 2)
    suite.tests.forEach(function (testCase) {
      t.test(testCase.description, function (t) {
        t.plan(1)
        t.equal(validator(testCase.value1)(testCase.value2), testCase.equal)
      })
      t.test(testCase.description + ' (reverse arguments)', function (t) {
        t.plan(1)
        t.equal(validator(testCase.value2)(testCase.value1), testCase.equal)
      })
    })
  })
})
