'use strict'

const test = require('tap').test
const build = require('..')

test('object with required field', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'integer'
      }
    },
    required: ['str']
  }
  const stringify = build(schema)

  try {
    stringify({
      str: 'string'
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  try {
    stringify({
      num: 42
    })
    t.fail()
  } catch (e) {
    t.is(e.message, '"str" is required!')
    t.pass()
  }
})

test('object with required field not in properties schema', (t) => {
  t.plan(4)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    required: ['str']
  }
  const stringify = build(schema)

  try {
    stringify({})
    t.fail()
  } catch (e) {
    t.is(e.message, '"str" is required!')
    t.pass()
  }

  try {
    stringify({
      num: 42
    })
    t.fail()
  } catch (e) {
    t.is(e.message, '"str" is required!')
    t.pass()
  }
})

test('object with required field not in properties schema with additional properties true', (t) => {
  t.plan(4)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    additionalProperties: true,
    required: ['str']
  }
  const stringify = build(schema)

  try {
    stringify({})
    t.fail()
  } catch (e) {
    t.is(e.message, '"str" is required!')
    t.pass()
  }

  try {
    stringify({
      num: 42
    })
    t.fail()
  } catch (e) {
    t.is(e.message, '"str" is required!')
    t.pass()
  }
})

test('object with multiple required field not in properties schema', (t) => {
  t.plan(6)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    additionalProperties: true,
    required: ['num', 'key1', 'key2']
  }
  const stringify = build(schema)

  try {
    stringify({})
    t.fail()
  } catch (e) {
    t.is(e.message, '"num" is required!')
    t.pass()
  }

  try {
    stringify({
      num: 42
    })
    t.fail()
  } catch (e) {
    t.is(e.message, '"key1" is required!')
    t.pass()
  }

  try {
    stringify({
      num: 42,
      key1: 'some'
    })
    t.fail()
  } catch (e) {
    t.is(e.message, '"key2" is required!')
    t.pass()
  }
})

test('object with required bool', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: 'integer'
      }
    },
    additionalProperties: true,
    required: ['bool']
  }
  const stringify = build(schema)

  try {
    stringify({})
    t.fail()
  } catch (e) {
    t.is(e.message, '"bool" is required!')
    t.pass()
  }

  try {
    stringify({
      bool: false
    })
    t.pass()
  } catch (e) {
    t.fail(e.message)
  }
})

test('required nullable', (t) => {
  t.plan(1)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      num: {
        type: ['integer']
      }
    },
    additionalProperties: true,
    required: ['null']
  }
  const stringify = build(schema)

  try {
    stringify({
      null: null
    })
    t.pass()
  } catch (e) {
    t.fail(e.message)
  }
})

test('required numbers', (t) => {
  t.plan(3)

  const schema = {
    title: 'object with required field',
    type: 'object',
    properties: {
      str: {
        type: 'string'
      },
      num: {
        type: 'integer'
      }
    },
    required: ['num']
  }
  const stringify = build(schema)

  try {
    stringify({
      num: 42
    })
    t.pass()
  } catch (e) {
    t.fail()
  }

  try {
    stringify({
      num: 'aaa'
    })
    t.fail()
  } catch (e) {
    t.is(e.message, '"num" is required!')
    t.pass()
  }
})
