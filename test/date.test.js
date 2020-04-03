'use strict'

const test = require('tap').test
const moment = require('moment')
const validator = require('is-my-json-valid')
const build = require('..')

test('render a date in a string as JSON', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string'
  }
  const toStringify = new Date()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a date in a string when format is date-format as ISOString', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date-time'
  }
  const toStringify = new Date()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a date in a string when format is date as YYYY-MM-DD', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'date'
  }
  const toStringify = new Date()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, `"${moment(toStringify).format('YYYY-MM-DD')}"`)
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a date in a string when format is time as HH:mm:ss', (t) => {
  t.plan(2)

  const schema = {
    title: 'a date in a string',
    type: 'string',
    format: 'time'
  }
  const toStringify = new Date()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  validate(JSON.parse(output))
  console.log(validate.errors)

  t.equal(output, `"${moment(toStringify).format('HH:mm:ss')}"`)
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a moment.js instance in a string when format is date-time as ISOString', (t) => {
  t.plan(2)

  const schema = {
    title: 'a moment.js object in a string',
    type: 'string',
    format: 'date-time'
  }
  const toStringify = moment()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a moment.js instance in a string when format is date as YYYY-MM-DD', (t) => {
  t.plan(2)

  const schema = {
    title: 'a moment.js object in a string',
    type: 'string',
    format: 'date'
  }
  const toStringify = moment()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, `"${toStringify.format('YYYY-MM-DD')}"`)
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a moment.js instance in a string when format is time as HH:mm:ss', (t) => {
  t.plan(2)

  const schema = {
    title: 'a moment.js object in a string',
    type: 'string',
    format: 'time'
  }
  const toStringify = moment()

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, `"${toStringify.format('HH:mm:ss')}"`)
  t.ok(validate(JSON.parse(output)), 'valid schema')
})

test('render a nested object in a string when type is date-format as ISOString', (t) => {
  t.plan(2)

  const schema = {
    title: 'an object in a string',
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date-time'
      }
    }
  }
  const toStringify = { date: moment() }

  const validate = validator(schema)
  const stringify = build(schema)
  const output = stringify(toStringify)

  t.equal(output, JSON.stringify(toStringify))
  t.ok(validate(JSON.parse(output)), 'valid schema')
})
